export type ModPlatformId = 'modrinth' | 'curseforge';

export type ModLoaderFilter = 'forge' | 'fabric' | 'quilt' | 'neoforge' | 'any';

export type ModSortOption = 'popularity' | 'date' | 'alphabetical';

export interface ModSearchQuery {
  platform: ModPlatformId;
  query: string;
  mcVersion?: string;
  loader?: ModLoaderFilter;
  offset?: number;
  limit?: number;
  sort?: ModSortOption;
}

export interface ModSearchResultItem {
  platform: ModPlatformId;
  projectId: string; // modrinth project id or curseforge modId as string
  slug?: string;
  title: string;
  description?: string;
  iconUrl?: string;
  downloads?: number;
}

export interface ModSearchResult {
  items: ModSearchResultItem[];
  total?: number;
  offset?: number;
  limit?: number;
}

export interface ModVersionQuery {
  platform: ModPlatformId;
  projectId: string;
  mcVersion?: string;
  loader?: ModLoaderFilter;
  offset?: number;
  limit?: number;
}

export interface ModFileDescriptor {
  url: string;
  filename: string;
  size?: number;
  hashes?: Record<string, string>;
  sha1?: string;
}

export interface ModVersionDescriptor {
  platform: ModPlatformId;
  versionId: string; // modrinth version id or curseforge fileId as string
  name: string;
  versionNumber?: string;
  mcVersions: string[];
  loaders: string[];
  files: ModFileDescriptor[];
}

export interface ModInstallRequest {
  platform: ModPlatformId;
  /**
   * If `platform=modrinth`: Modrinth version id.
   * If `platform=curseforge`: Curseforge file id.
   */
  versionId: string;
  /**
   * Project id / modId used to resolve download url for some platforms.
   */
  projectId: string;
  /**
   * Optional override of Minecraft root path. Defaults to app userData minecraft_data.
   */
  rootPath?: string;
  /**
   * Install destination instance id (instances/<id>/mods). Preferred over rootPath/mods.
   */
  instanceId?: string;
  /**
   * Install destination instance path (mods/ inside). Used when caller already knows the full path.
   */
  instancePath?: string;
  /**
   * Optional extra fallback urls to try after the primary one.
   */
  fallbackUrls?: string[];
}

export interface ModInstallResult {
  destination: string;
  filename: string;
  usedUrl: string;
  skipped?: boolean;
}

