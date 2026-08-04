import type { ModInstallResponse } from '@shared/contracts/mods';
import type {
  ShaderPackAcquisitionIssue,
  ShaderPackAcquisitionResult,
  ShadersAPI,
} from '@shared/contracts/shaders';
import { modsIPC, type ModsIPC } from '../../../services/ipc/modsIPC';
import { shadersIPC } from '../../../services/ipc/shadersIPC';
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

export interface ShaderContentAcquisitionItem extends ContentAcquisitionItem {
  platform: 'curseforge' | 'modrinth';
  projectId: string;
  slug?: string;
  iconUrl?: string;
  downloads?: number;
}

export interface ShaderContentAcquisitionSelection extends ContentAcquisitionSelection {
  platform: 'curseforge' | 'modrinth';
  projectId: string;
  versionId: string;
  versionLabel: string;
  minecraftVersions?: readonly string[];
}

type ShaderAdapterDependencies = {
  mods: Pick<ModsIPC, 'searchMods' | 'getModVersions' | 'installModFile'>;
  shaders: Pick<ShadersAPI, 'add'>;
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

export function createRendererShaderContentAcquisitionAdapter(
  onCommitted?: ShaderAdapterDependencies['onCommitted'],
) {
  return createShaderContentAcquisitionAdapter({
    mods: modsIPC,
    shaders: shadersIPC,
    onCommitted,
  });
}

export function createShaderContentAcquisitionAdapter(
  dependencies: ShaderAdapterDependencies,
): ContentAcquisitionAdapter<'shader', ShaderContentAcquisitionItem, ShaderContentAcquisitionSelection> {
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
    kind: 'shader',
    async search(request) {
      const result = await dependencies.mods.searchMods({
        platform: platformFilter(request.filters),
        query: request.query.trim(),
        mcVersion: valueFilter(request.filters, 'minecraftVersion') ?? request.runtime.minecraftVersion,
        sort: sortFilter(request.filters),
        offset: request.page,
        limit: PAGE_SIZE,
        contentType: 'shader',
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
        contentType: 'shader',
      });
      const version = normalizeVersions(result)[0];
      if (!version) throw new Error(`No compatible shader version is available for ${item.label}`);
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
      if (runtime.shaderSupport === 'unsupported') {
        return {
          didCommit: false,
          isPresentationSuccess: false,
          committedSelectionIds: [],
          retainedSelectionIds: selections.map(({ id }) => id),
          issues: selections.map((shader) => issue(shader, 'runtime-blocked')),
        };
      }

      const committedSelectionIds: string[] = [];
      const retainedSelectionIds: string[] = [];
      const issues: AcquisitionIssue[] = [];

      for (const shader of selections) {
        const pendingKey = catalogPendingKey(runtime.instanceId, shader.id);
        if (pendingCatalogInvalidations.has(pendingKey)) {
          committedSelectionIds.push(shader.id);
          continue;
        }

        try {
          const result = await dependencies.mods.installModFile({
            platform: shader.platform,
            projectId: shader.projectId,
            versionId: shader.versionId,
            instanceId: runtime.instanceId,
            contentType: 'shader',
          });
          if (result.status !== 'success') {
            retainedSelectionIds.push(shader.id);
            issues.push(issueFromInstallResult(shader, result));
            continue;
          }
          committedSelectionIds.push(shader.id);
          pendingCatalogInvalidations.add(pendingKey);
        } catch {
          retainedSelectionIds.push(shader.id);
          issues.push(issue(shader, 'install-failure'));
        }
      }

      const didCommit = committedSelectionIds.length > 0;
      const outcome: AcquisitionOutcome = {
        didCommit,
        isPresentationSuccess: didCommit && retainedSelectionIds.length === 0 && issues.length === 0,
        committedSelectionIds,
        retainedSelectionIds,
        issues,
      };

      if (!didCommit) return outcome;
      if (await notifyCommitted(outcome)) {
        for (const selectionId of committedSelectionIds) {
          pendingCatalogInvalidations.delete(catalogPendingKey(runtime.instanceId, selectionId));
        }
        return outcome;
      }

      return canonicalFailureOutcome(outcome, committedSelectionIds, 'Added shaders');
    },
    async importLocal({ runtime }) {
      const pending = pendingLocalInvalidations.get(runtime.instanceId);
      if (pending) {
        if (await notifyCommitted(pending)) {
          pendingLocalInvalidations.delete(runtime.instanceId);
          return pending;
        }
        return canonicalFailureOutcome(pending, pending.committedSelectionIds, 'Imported shaders');
      }

      const result = await dependencies.shaders.add(runtime.instanceId);
      const outcome = normalizeLocalOutcome(result);
      if (!outcome.didCommit) return outcome;
      if (await notifyCommitted(outcome)) return outcome;

      pendingLocalInvalidations.set(runtime.instanceId, outcome);
      return canonicalFailureOutcome(outcome, outcome.committedSelectionIds, 'Imported shaders');
    },
  };
}

function canonicalFailureOutcome(
  outcome: AcquisitionOutcome,
  committedSelectionIds: readonly string[],
  fallbackLabel: string,
): AcquisitionOutcome {
  return {
    ...outcome,
    isPresentationSuccess: false,
    retainedSelectionIds: [...new Set([...outcome.retainedSelectionIds, ...committedSelectionIds])],
    issues: [
      ...outcome.issues,
      {
        selectionId: committedSelectionIds[0] ?? 'shader-acquisition',
        label: fallbackLabel,
        code: 'unknown',
      },
    ],
  };
}

function normalizeLocalOutcome(result: ShaderPackAcquisitionResult): AcquisitionOutcome {
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

function issueFromLocalResult(result: ShaderPackAcquisitionIssue): AcquisitionIssue {
  const label = sanitizeLogicalFileName(result.fileName, 'Shader pack');
  return {
    selectionId: localSelectionId(label),
    label,
    code: result.status === 'failure' ? 'install-failure' : result.status,
  };
}

function localSelectionId(fileName: string) {
  return `local:${sanitizeLogicalFileName(fileName, 'shader-pack.zip')}`;
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

function normalizeSearchResult(value: unknown): { items: ShaderContentAcquisitionItem[]; total: number } {
  if (!isRecord(value) || !Array.isArray(value.items)) {
    throw new Error('Shader search returned an invalid result');
  }
  const items = value.items.map(normalizeSearchItem);
  const total = typeof value.total === 'number' && Number.isFinite(value.total)
    ? Math.max(items.length, Math.trunc(value.total))
    : items.length;
  return { items, total };
}

function normalizeSearchItem(value: unknown): ShaderContentAcquisitionItem {
  if (!isRecord(value)
    || !isPlatform(value.platform)
    || typeof value.projectId !== 'string'
    || typeof value.title !== 'string') {
    throw new Error('Shader search returned an invalid item');
  }
  const raw = value as RawSearchItem;
  return {
    id: `${raw.platform}:${raw.projectId}`,
    label: sanitizeUiText(raw.title, 'Untitled shader'),
    platform: raw.platform,
    projectId: raw.projectId,
    ...(typeof raw.slug === 'string' ? { slug: raw.slug } : {}),
    ...(typeof raw.description === 'string' ? { description: sanitizeUiText(raw.description, '') } : {}),
    ...(typeof raw.iconUrl === 'string' ? { iconUrl: raw.iconUrl } : {}),
    ...(typeof raw.downloads === 'number' && Number.isFinite(raw.downloads) ? { downloads: raw.downloads } : {}),
  };
}

function normalizeVersions(value: unknown): RawVersion[] {
  if (!Array.isArray(value)) throw new Error('Shader versions returned an invalid result');
  return value.map((entry) => {
    if (!isRecord(entry)
      || !isPlatform(entry.platform)
      || typeof entry.versionId !== 'string'
      || typeof entry.name !== 'string') {
      throw new Error('Shader versions returned an invalid item');
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
  selection: ShaderContentAcquisitionSelection,
  result: ModInstallResponse,
): AcquisitionIssue {
  return issue(
    selection,
    result.status === 'failure' || result.status === 'success' ? 'install-failure' : result.status,
  );
}

function issue(
  selection: ShaderContentAcquisitionSelection,
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

export type ShaderContentRuntime = ContentRuntimeInput<'shader'>;
