import type { ModInstallResponse } from '@shared/contracts/mods';
import type {
  ResourcePackAcquisitionIssue,
  ResourcePackAcquisitionResult,
  ResourcePacksAPI,
} from '@shared/contracts/resourcePacks';
import { modsIPC, type ModsIPC } from '../../../services/ipc/modsIPC';
import { resourcePacksIPC } from '../../../services/ipc/resourcePacksIPC';
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

export interface ResourcePackContentAcquisitionItem extends ContentAcquisitionItem {
  platform: 'curseforge' | 'modrinth';
  projectId: string;
  slug?: string;
  iconUrl?: string;
  downloads?: number;
}

export interface ResourcePackContentAcquisitionSelection extends ContentAcquisitionSelection {
  platform: 'curseforge' | 'modrinth';
  projectId: string;
  versionId: string;
  versionLabel: string;
  minecraftVersions?: readonly string[];
}

type ResourcePackAdapterDependencies = {
  mods: Pick<ModsIPC, 'searchMods' | 'getModVersions' | 'installModFile'>;
  resourcePacks: Pick<ResourcePacksAPI, 'add'>;
  onCommitted?: (outcome: AcquisitionOutcome) => void | Promise<void>;
};

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
};

export function createRendererResourcePackContentAcquisitionAdapter(
  onCommitted?: ResourcePackAdapterDependencies['onCommitted'],
) {
  return createResourcePackContentAcquisitionAdapter({
    mods: modsIPC,
    resourcePacks: resourcePacksIPC,
    onCommitted,
  });
}

export function createResourcePackContentAcquisitionAdapter(
  dependencies: ResourcePackAdapterDependencies,
): ContentAcquisitionAdapter<
  'resourcepack',
  ResourcePackContentAcquisitionItem,
  ResourcePackContentAcquisitionSelection
> {
  const pendingCatalogInvalidations = new Set<string>();
  const pendingLocalInvalidations = new Map<string, AcquisitionOutcome>();

  const notifyCommitted = async (outcome: AcquisitionOutcome) => {
    if (!dependencies.onCommitted) return true;
    try {
      await dependencies.onCommitted(outcome);
      return true;
    } catch {
      return false;
    }
  };

  return {
    kind: 'resourcepack',
    async search(request) {
      const result = await dependencies.mods.searchMods({
        platform: platformFilter(request.filters),
        query: request.query.trim(),
        mcVersion: valueFilter(request.filters, 'minecraftVersion') ?? request.runtime.minecraftVersion,
        sort: sortFilter(request.filters),
        offset: request.page,
        limit: PAGE_SIZE,
        contentType: 'resourcepack',
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
        contentType: 'resourcepack',
      });
      const version = normalizeVersions(result)[0];
      if (!version) throw new Error(`No compatible resource-pack version is available for ${item.label}`);
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
        ...(version.mcVersions ? { minecraftVersions: version.mcVersions } : {}),
      };
    },
    async install({ selections, runtime }) {
      const committedSelectionIds: string[] = [];
      const retainedSelectionIds: string[] = [];
      const issues: AcquisitionIssue[] = [];

      for (const selection of selections) {
        const pendingKey = catalogPendingKey(runtime.instanceId, selection.id);
        if (pendingCatalogInvalidations.has(pendingKey)) {
          committedSelectionIds.push(selection.id);
          continue;
        }

        try {
          const result = await dependencies.mods.installModFile({
            platform: selection.platform,
            projectId: selection.projectId,
            versionId: selection.versionId,
            instanceId: runtime.instanceId,
            contentType: 'resourcepack',
          });
          if (result.status !== 'success') {
            retainedSelectionIds.push(selection.id);
            issues.push(issueFromInstallResult(selection, result));
            continue;
          }
          committedSelectionIds.push(selection.id);
          pendingCatalogInvalidations.add(pendingKey);
        } catch {
          retainedSelectionIds.push(selection.id);
          issues.push(issue(selection, 'install-failure'));
        }
      }

      const didCommit = committedSelectionIds.length > 0;
      const baseOutcome: AcquisitionOutcome = {
        didCommit,
        isPresentationSuccess: didCommit && retainedSelectionIds.length === 0 && issues.length === 0,
        committedSelectionIds,
        retainedSelectionIds,
        issues,
      };

      if (!didCommit) return baseOutcome;
      if (await notifyCommitted(baseOutcome)) {
        for (const selectionId of committedSelectionIds) {
          pendingCatalogInvalidations.delete(catalogPendingKey(runtime.instanceId, selectionId));
        }
        return baseOutcome;
      }

      return canonicalFailureOutcome(baseOutcome, committedSelectionIds, 'Added resource packs');
    },
    async importLocal({ runtime }) {
      const pending = pendingLocalInvalidations.get(runtime.instanceId);
      if (pending) {
        if (await notifyCommitted(pending)) {
          pendingLocalInvalidations.delete(runtime.instanceId);
          return pending;
        }
        return canonicalFailureOutcome(pending, pending.committedSelectionIds, 'Imported resource packs');
      }

      const result = await dependencies.resourcePacks.add(runtime.instanceId);
      const outcome = normalizeLocalOutcome(result);
      if (!outcome.didCommit) return outcome;
      if (await notifyCommitted(outcome)) return outcome;

      pendingLocalInvalidations.set(runtime.instanceId, outcome);
      return canonicalFailureOutcome(outcome, outcome.committedSelectionIds, 'Imported resource packs');
    },
  };
}

function canonicalFailureOutcome(
  outcome: AcquisitionOutcome,
  committedSelectionIds: readonly string[],
  fallbackLabel: string,
): AcquisitionOutcome {
  const retainedSelectionIds = [...new Set([
    ...outcome.retainedSelectionIds,
    ...committedSelectionIds,
  ])];
  return {
    ...outcome,
    isPresentationSuccess: false,
    retainedSelectionIds,
    issues: [
      ...outcome.issues,
      {
        selectionId: committedSelectionIds[0] ?? 'resourcepack-acquisition',
        label: fallbackLabel,
        code: 'unknown',
      },
    ],
  };
}

function normalizeLocalOutcome(result: ResourcePackAcquisitionResult): AcquisitionOutcome {
  const committedSelectionIds = result.importedFileNames.map(localSelectionId);
  const issues = result.issues.map(issueFromLocalResult);
  return {
    didCommit: committedSelectionIds.length > 0,
    isPresentationSuccess: result.status === 'success' && committedSelectionIds.length > 0 && issues.length === 0,
    committedSelectionIds,
    retainedSelectionIds: issues.map(({ selectionId }) => selectionId),
    issues,
  };
}

function issueFromLocalResult(result: ResourcePackAcquisitionIssue): AcquisitionIssue {
  const label = sanitizeLogicalFileName(result.fileName, 'Resource pack');
  return {
    selectionId: localSelectionId(label),
    label,
    code: result.status === 'failure' ? 'install-failure' : result.status,
  };
}

function localSelectionId(fileName: string) {
  return `local:${sanitizeLogicalFileName(fileName, 'resource-pack.zip')}`;
}

function sanitizeLogicalFileName(value: string, fallback: string) {
  const logicalName = value
    .replace(/\0/g, '')
    .split(/[\\/]/)
    .at(-1)
    ?.replace(/\s+/g, ' ')
    .trim()
    .slice(0, 240) ?? '';
  return sanitizeUiText(logicalName.replace(/\./g, ' '), fallback) === fallback
    ? fallback
    : logicalName;
}

function catalogPendingKey(instanceId: string, selectionId: string) {
  return `${instanceId}\u0000${selectionId}`;
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

function normalizeSearchResult(value: unknown): { items: ResourcePackContentAcquisitionItem[]; total: number } {
  if (!isRecord(value) || !Array.isArray(value.items)) {
    throw new Error('Resource-pack search returned an invalid result');
  }
  const items = value.items.map(normalizeSearchItem);
  const total = typeof value.total === 'number' && Number.isFinite(value.total)
    ? Math.max(items.length, Math.trunc(value.total))
    : items.length;
  return { items, total };
}

function normalizeSearchItem(value: unknown): ResourcePackContentAcquisitionItem {
  if (!isRecord(value)
    || !isPlatform(value.platform)
    || typeof value.projectId !== 'string'
    || typeof value.title !== 'string') {
    throw new Error('Resource-pack search returned an invalid item');
  }
  const raw = value as RawSearchItem;
  return {
    id: `${raw.platform}:${raw.projectId}`,
    label: sanitizeUiText(raw.title, 'Untitled resource pack'),
    platform: raw.platform,
    projectId: raw.projectId,
    ...(typeof raw.slug === 'string' ? { slug: raw.slug } : {}),
    ...(typeof raw.description === 'string' ? { description: sanitizeUiText(raw.description, '') } : {}),
    ...(typeof raw.iconUrl === 'string' ? { iconUrl: raw.iconUrl } : {}),
    ...(typeof raw.downloads === 'number' && Number.isFinite(raw.downloads) ? { downloads: raw.downloads } : {}),
  };
}

function normalizeVersions(value: unknown): RawVersion[] {
  if (!Array.isArray(value)) throw new Error('Resource-pack versions returned an invalid result');
  return value.map((entry) => {
    if (!isRecord(entry)
      || !isPlatform(entry.platform)
      || typeof entry.versionId !== 'string'
      || typeof entry.name !== 'string') {
      throw new Error('Resource-pack versions returned an invalid item');
    }
    return {
      platform: entry.platform,
      versionId: entry.versionId,
      name: entry.name,
      ...(typeof entry.versionNumber === 'string' ? { versionNumber: entry.versionNumber } : {}),
      ...(Array.isArray(entry.mcVersions) && entry.mcVersions.every((item) => typeof item === 'string')
        ? { mcVersions: [...entry.mcVersions] as string[] }
        : {}),
    };
  });
}

function issueFromInstallResult(
  selection: ResourcePackContentAcquisitionSelection,
  result: ModInstallResponse,
): AcquisitionIssue {
  return issue(
    selection,
    result.status === 'failure' || result.status === 'success' ? 'install-failure' : result.status,
  );
}

function issue(
  selection: ResourcePackContentAcquisitionSelection,
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

export type ResourcePackContentRuntime = ContentRuntimeInput<'resourcepack'>;
