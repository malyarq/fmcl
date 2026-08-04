import { ipcMain } from 'electron';
import {
  PROVIDER_CATALOG_CHANNELS,
  type ProviderCatalogSearchRequest,
  type ProviderCatalogSearchResult,
  type ProviderCatalogVersionDescriptor,
  type ProviderCatalogVersionsRequest,
} from '../../../shared/contracts/providerCatalog';
import {
  validateBoundedString,
  validateEnum,
  validateInteger,
  validateOptionalBoundedString,
} from '../validation/privilegedPayloads';

const PROVIDER_CATALOG_PLATFORMS = ['curseforge', 'modrinth'] as const;
const PROVIDER_CATALOG_SORTS = ['popularity', 'date', 'alphabetical'] as const;

type ProviderCatalogAdapter = Readonly<{
  searchCurseForgeModpacks(
    query: string,
    minecraftVersion?: string,
    loader?: string,
    sort?: 'popularity' | 'date' | 'alphabetical',
    offset?: number,
    limit?: number,
  ): Promise<ProviderCatalogSearchResult>;
  searchModrinthModpacks(
    query: string,
    minecraftVersion?: string,
    loader?: string,
    sort?: 'popularity' | 'date' | 'alphabetical',
    offset?: number,
    limit?: number,
  ): Promise<ProviderCatalogSearchResult>;
  getCurseForgeModpackVersions(projectId: number): Promise<readonly ProviderCatalogVersionDescriptor[]>;
  getModrinthModpackVersions(projectId: string): Promise<readonly ProviderCatalogVersionDescriptor[]>;
}>;

type ProviderCatalogHandlerDependencies = Readonly<{ providerCatalog: ProviderCatalogAdapter }>;
type PlainObject = Record<string, unknown>;

function requireObject(value: unknown, label: string): PlainObject {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }

  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new Error(`${label} must be a plain object.`);
  }

  return value as PlainObject;
}

function rejectUnknownFields(value: PlainObject, allowed: readonly string[], label: string): void {
  const unknownFields = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unknownFields.length > 0) {
    throw new Error(`${label} contains unsupported field${unknownFields.length === 1 ? '' : 's'}: ${unknownFields.join(', ')}.`);
  }
}

function optionalOffset(value: unknown): number | undefined {
  return value === undefined ? undefined : validateInteger(value, 'Provider catalog offset', { min: 0, max: 10_000 });
}

function optionalLimit(value: unknown): number | undefined {
  return value === undefined ? undefined : validateInteger(value, 'Provider catalog limit', { min: 1, max: 200 });
}

function validateSearchRequest(value: unknown): ProviderCatalogSearchRequest {
  const request = requireObject(value, 'Provider catalog search request');
  rejectUnknownFields(request, ['platform', 'query', 'minecraftVersion', 'loader', 'sort', 'offset', 'limit'], 'Provider catalog search request');

  return {
    platform: validateEnum(request.platform, 'Provider catalog platform', PROVIDER_CATALOG_PLATFORMS),
    query: validateBoundedString(request.query, 'Provider catalog search query', { allowEmpty: true, maxLength: 200 }),
    minecraftVersion: validateOptionalBoundedString(request.minecraftVersion, 'Minecraft version filter', { maxLength: 64 }),
    loader: validateOptionalBoundedString(request.loader, 'Mod loader filter', { maxLength: 64 }),
    sort: request.sort === undefined ? undefined : validateEnum(request.sort, 'Provider catalog sort', PROVIDER_CATALOG_SORTS),
    offset: optionalOffset(request.offset),
    limit: optionalLimit(request.limit),
  };
}

function validateVersionsRequest(value: unknown): ProviderCatalogVersionsRequest {
  const request = requireObject(value, 'Provider catalog versions request');
  rejectUnknownFields(request, ['platform', 'projectId'], 'Provider catalog versions request');

  return {
    platform: validateEnum(request.platform, 'Provider catalog platform', PROVIDER_CATALOG_PLATFORMS),
    projectId: validateBoundedString(request.projectId, 'Provider catalog project id', { maxLength: 128 }),
  };
}

function toCurseForgeProjectId(projectId: string): number {
  if (!/^\d+$/.test(projectId)) {
    throw new Error('CurseForge project id must be a positive integer.');
  }

  return validateInteger(Number(projectId), 'CurseForge project id', { min: 1 });
}

/** Registers read-only provider discovery through the injected main-process adapter. */
export function registerProviderCatalogHandlers({ providerCatalog }: ProviderCatalogHandlerDependencies): void {
  ipcMain.removeHandler(PROVIDER_CATALOG_CHANNELS.search);
  ipcMain.handle(PROVIDER_CATALOG_CHANNELS.search, async (_event, request: unknown) => {
    const parsed = validateSearchRequest(request);
    const { query, minecraftVersion, loader, sort, offset, limit } = parsed;

    return parsed.platform === 'curseforge'
      ? providerCatalog.searchCurseForgeModpacks(query, minecraftVersion, loader, sort, offset, limit)
      : providerCatalog.searchModrinthModpacks(query, minecraftVersion, loader, sort, offset, limit);
  });

  ipcMain.removeHandler(PROVIDER_CATALOG_CHANNELS.versions);
  ipcMain.handle(PROVIDER_CATALOG_CHANNELS.versions, async (_event, request: unknown) => {
    const parsed = validateVersionsRequest(request);
    return parsed.platform === 'curseforge'
      ? providerCatalog.getCurseForgeModpackVersions(toCurseForgeProjectId(parsed.projectId))
      : providerCatalog.getModrinthModpackVersions(parsed.projectId);
  });
}
