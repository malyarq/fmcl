/**
 * Renderer-safe provider catalogue transport.
 *
 * The catalogue is deliberately read-only: instance mutation and native
 * authority stay behind their dedicated main-process boundaries.
 */
export const PROVIDER_CATALOG_CHANNELS = {
  search: 'providerCatalog:search',
  versions: 'providerCatalog:versions',
} as const;

export type ProviderCatalogChannel = (typeof PROVIDER_CATALOG_CHANNELS)[keyof typeof PROVIDER_CATALOG_CHANNELS];

export type ProviderCatalogPlatform = 'curseforge' | 'modrinth';
export type ProviderCatalogSort = 'popularity' | 'date' | 'alphabetical';

export type ProviderCatalogSearchRequest = Readonly<{
  platform: ProviderCatalogPlatform;
  query: string;
  minecraftVersion?: string;
  loader?: string;
  sort?: ProviderCatalogSort;
  offset?: number;
  limit?: number;
}>;

export type ProviderCatalogSearchResultItem = Readonly<{
  platform: ProviderCatalogPlatform;
  projectId: string;
  slug?: string;
  title: string;
  description?: string;
  iconUrl?: string;
  minecraftVersion?: string;
  downloads?: number;
  dateCreated?: string;
  dateModified?: string;
}>;

export type ProviderCatalogSearchResult = Readonly<{
  items: readonly ProviderCatalogSearchResultItem[];
  total?: number;
  offset?: number;
  limit?: number;
}>;

export type ProviderCatalogVersionsRequest = Readonly<{
  platform: ProviderCatalogPlatform;
  projectId: string;
}>;

export type ProviderCatalogVersionDescriptor = Readonly<{
  platform: ProviderCatalogPlatform;
  versionId: string;
  name: string;
  versionNumber?: string;
  mcVersions: readonly string[];
  loaders: readonly string[];
  fileId?: number;
  changelog?: string;
  files: readonly Readonly<{
    url: string;
    filename: string;
    size?: number;
    sha1?: string;
  }>[];
}>;

/** Dedicated typed preload capability for remote provider discovery only. */
export type ProviderCatalogAPI = Readonly<{
  search(request: ProviderCatalogSearchRequest): Promise<ProviderCatalogSearchResult>;
  versions(request: ProviderCatalogVersionsRequest): Promise<readonly ProviderCatalogVersionDescriptor[]>;
}>;
