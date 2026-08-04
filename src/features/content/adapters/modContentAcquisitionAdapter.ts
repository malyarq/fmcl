import type { ModInstallResponse } from '@shared/contracts/mods';
import { instanceModsIPC, type InstanceModsIPC } from '../../../services/ipc/instanceModsIPC';
import { modsIPC, type ModsIPC } from '../../../services/ipc/modsIPC';
import { sanitizeUiText } from '../../../utils/safeUiText';
import type {
  AcquisitionIssue,
  AcquisitionOutcome,
  ContentAcquisitionAdapter,
  ContentAcquisitionFilters,
  ContentAcquisitionItem,
  ContentAcquisitionSelection,
  ContentRuntimeInput,
} from '../contentAcquisitionTypes';

const PAGE_SIZE = 20;
const PLATFORMS = new Set(['curseforge', 'modrinth']);
const SORTS = new Set(['popularity', 'date', 'alphabetical']);

export interface ModContentAcquisitionItem extends ContentAcquisitionItem {
  platform: 'curseforge' | 'modrinth';
  projectId: string;
  slug?: string;
  iconUrl?: string;
  downloads?: number;
}

export interface ModContentAcquisitionSelection extends ContentAcquisitionSelection {
  platform: 'curseforge' | 'modrinth';
  projectId: string;
  versionId: string;
  versionLabel: string;
  minecraftVersions?: readonly string[];
  loaders?: readonly string[];
}

type ModAdapterDependencies = {
  mods: Pick<ModsIPC, 'searchMods' | 'getModVersions' | 'installModFile'>;
  instanceMods: Pick<InstanceModsIPC, 'register'>;
  onCommitted?: (outcome: AcquisitionOutcome) => void | Promise<void>;
};

export function createRendererModContentAcquisitionAdapter(
  onCommitted?: ModAdapterDependencies['onCommitted'],
) {
  return createModContentAcquisitionAdapter({ mods: modsIPC, instanceMods: instanceModsIPC, onCommitted });
}

type RawSearchItem = {
  platform: 'curseforge' | 'modrinth';
  projectId: string;
  title: string;
  slug?: string;
  description?: string;
  iconUrl?: string;
  downloads?: number;
};

type RawVersion = {
  platform: 'curseforge' | 'modrinth';
  versionId: string;
  name: string;
  versionNumber?: string;
  mcVersions?: string[];
  loaders?: string[];
};

export function createModContentAcquisitionAdapter(
  dependencies: ModAdapterDependencies,
): ContentAcquisitionAdapter<'mod', ModContentAcquisitionItem, ModContentAcquisitionSelection> {
  const pendingManifestRegistration = new Set<string>();

  return {
    kind: 'mod',
    async search(request) {
      const result = await dependencies.mods.searchMods({
        platform: platformFilter(request.filters),
        query: request.query.trim(),
        mcVersion: valueFilter(request.filters, 'minecraftVersion') ?? request.runtime.minecraftVersion,
        loader: valueFilter(request.filters, 'loader') ?? request.runtime.loader,
        sort: sortFilter(request.filters),
        offset: request.page,
        limit: PAGE_SIZE,
        contentType: 'mod',
      });
      const normalized = normalizeSearchResult(result);
      const consumed = request.page + normalized.items.length;
      return {
        items: normalized.items,
        total: normalized.total,
        nextPage: normalized.items.length > 0 && consumed < normalized.total ? consumed : null,
      };
    },
    async resolveSelection({ item, filters, runtime }) {
      const result = await dependencies.mods.getModVersions({
        platform: item.platform,
        projectId: item.projectId,
        mcVersion: valueFilter(filters, 'minecraftVersion') ?? runtime.minecraftVersion,
        loader: valueFilter(filters, 'loader') ?? runtime.loader,
      });
      const version = normalizeVersions(result)[0];
      if (!version) throw new Error(`No compatible version is available for ${item.label}`);
      return {
        id: item.id,
        label: item.label,
        platform: item.platform,
        projectId: item.projectId,
        versionId: version.versionId,
        versionLabel: sanitizeUiText(
          version.name,
          sanitizeUiText(version.versionNumber, sanitizeUiText(version.versionId, 'Version unavailable')),
        ),
        minecraftVersions: version.mcVersions,
        loaders: version.loaders,
      };
    },
    async install({ selections, runtime }) {
      const committedSelectionIds: string[] = [];
      const retainedSelectionIds: string[] = [];
      const issues: AcquisitionIssue[] = [];
      let didCommit = false;

      for (const selection of selections) {
        const pendingKey = `${runtime.instanceId}\u0000${selection.id}`;
        if (!pendingManifestRegistration.has(pendingKey)) {
          try {
            const result = await dependencies.mods.installModFile({
              platform: selection.platform,
              projectId: selection.projectId,
              versionId: selection.versionId,
              instanceId: runtime.instanceId,
              contentType: 'mod',
            });
            if (result.status !== 'success') {
              retainedSelectionIds.push(selection.id);
              issues.push(issueFromInstallResult(selection, result));
              continue;
            }
            didCommit = true;
            pendingManifestRegistration.add(pendingKey);
          } catch {
            retainedSelectionIds.push(selection.id);
            issues.push(issue(selection, 'install-failure'));
            continue;
          }
        }

        try {
          await dependencies.instanceMods.register(runtime.instanceId, {
            platform: selection.platform,
            projectId: selection.projectId,
            versionId: selection.versionId,
          });
          didCommit = true;
          pendingManifestRegistration.delete(pendingKey);
          committedSelectionIds.push(selection.id);
        } catch {
          didCommit = true;
          retainedSelectionIds.push(selection.id);
          issues.push(issue(selection, 'manifest-failure'));
        }
      }

      let outcome: AcquisitionOutcome = {
        didCommit,
        isPresentationSuccess: selections.length > 0 && retainedSelectionIds.length === 0 && issues.length === 0,
        committedSelectionIds,
        retainedSelectionIds,
        issues,
      };

      if (didCommit && dependencies.onCommitted) {
        try {
          await dependencies.onCommitted(outcome);
        } catch {
          outcome = {
            ...outcome,
            isPresentationSuccess: false,
            issues: [...outcome.issues, {
              selectionId: committedSelectionIds[0] ?? selections[0]?.id ?? 'mod-acquisition',
              label: committedSelectionIds.length > 0 ? 'Installed mods' : 'Mod installation',
              code: 'unknown',
            }],
          };
        }
      }

      return outcome;
    },
  };
}

function platformFilter(filters: ContentAcquisitionFilters): 'curseforge' | 'modrinth' {
  const value = filters.platform;
  return typeof value === 'string' && PLATFORMS.has(value)
    ? value as 'curseforge' | 'modrinth'
    : 'modrinth';
}

function sortFilter(filters: ContentAcquisitionFilters): 'popularity' | 'date' | 'alphabetical' {
  const value = filters.sort;
  return typeof value === 'string' && SORTS.has(value)
    ? value as 'popularity' | 'date' | 'alphabetical'
    : 'popularity';
}

function valueFilter(filters: ContentAcquisitionFilters, key: string): string | undefined {
  const value = filters[key]?.trim();
  return value || undefined;
}

function normalizeSearchResult(value: unknown): { items: ModContentAcquisitionItem[]; total: number } {
  if (!isRecord(value) || !Array.isArray(value.items)) throw new Error('Mod search returned an invalid result');
  const items = value.items.map(normalizeSearchItem);
  const total = typeof value.total === 'number' && Number.isFinite(value.total)
    ? Math.max(items.length, Math.trunc(value.total))
    : items.length;
  return { items, total };
}

function normalizeSearchItem(value: unknown): ModContentAcquisitionItem {
  if (!isRecord(value)
    || !isPlatform(value.platform)
    || typeof value.projectId !== 'string'
    || typeof value.title !== 'string') {
    throw new Error('Mod search returned an invalid item');
  }
  const raw = value as RawSearchItem;
  return {
    id: `${raw.platform}:${raw.projectId}`,
    label: sanitizeUiText(raw.title, 'Untitled mod'),
    platform: raw.platform,
    projectId: raw.projectId,
    ...(typeof raw.slug === 'string' ? { slug: raw.slug } : {}),
    ...(typeof raw.description === 'string' ? { description: sanitizeUiText(raw.description, '') } : {}),
    ...(typeof raw.iconUrl === 'string' ? { iconUrl: raw.iconUrl } : {}),
    ...(typeof raw.downloads === 'number' && Number.isFinite(raw.downloads) ? { downloads: raw.downloads } : {}),
  };
}

function normalizeVersions(value: unknown): RawVersion[] {
  if (!Array.isArray(value)) throw new Error('Mod versions returned an invalid result');
  return value.map((entry) => {
    if (!isRecord(entry)
      || !isPlatform(entry.platform)
      || typeof entry.versionId !== 'string'
      || typeof entry.name !== 'string') {
      throw new Error('Mod versions returned an invalid item');
    }
    return {
      platform: entry.platform,
      versionId: entry.versionId,
      name: entry.name,
      ...(typeof entry.versionNumber === 'string' ? { versionNumber: entry.versionNumber } : {}),
      ...(Array.isArray(entry.mcVersions) && entry.mcVersions.every((item) => typeof item === 'string')
        ? { mcVersions: [...entry.mcVersions] as string[] }
        : {}),
      ...(Array.isArray(entry.loaders) && entry.loaders.every((item) => typeof item === 'string')
        ? { loaders: [...entry.loaders] as string[] }
        : {}),
    };
  });
}

function issueFromInstallResult(
  selection: ModContentAcquisitionSelection,
  result: ModInstallResponse,
): AcquisitionIssue {
  const code: AcquisitionIssue['code'] = result.status === 'failure' || result.status === 'success'
    ? 'install-failure'
    : result.status;
  return issue(selection, code);
}

function issue(
  selection: ModContentAcquisitionSelection,
  code: AcquisitionIssue['code'],
): AcquisitionIssue {
  return { selectionId: selection.id, label: selection.label, code };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isPlatform(value: unknown): value is 'curseforge' | 'modrinth' {
  return typeof value === 'string' && PLATFORMS.has(value);
}

export type ModContentRuntime = ContentRuntimeInput<'mod'>;
