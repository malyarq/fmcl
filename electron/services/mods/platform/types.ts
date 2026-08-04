export type ModPlatformId = 'modrinth' | 'curseforge';

export type ModLoaderFilter = 'forge' | 'fabric' | 'quilt' | 'neoforge' | 'any';

export type ModSortOption = 'popularity' | 'date' | 'alphabetical';

export type ContentType = 'mod' | 'resourcepack' | 'shader' | 'datapack';

export interface ModSearchQuery {
  platform: ModPlatformId;
  query: string;
  mcVersion?: string;
  loader?: ModLoaderFilter;
  offset?: number;
  limit?: number;
  sort?: ModSortOption;
  /** Type of content to search for. Defaults to 'mod'. */
  contentType?: ContentType;
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

export interface LegacyModInstallResult {
  destination: string;
  filename: string;
  usedUrl: string;
  skipped?: boolean;
}

export type GuidedContentInstallStatus =
  | 'success'
  | 'duplicate'
  | 'invalid-archive'
  | 'runtime-blocked'
  | 'failure';

export type GuidedContentInstallIssueStatus = Exclude<GuidedContentInstallStatus, 'success'>;

export interface GuidedContentInstallIssue {
  fileName: string;
  status: GuidedContentInstallIssueStatus;
  message: string;
}

export interface GuidedContentInstallResult {
  status: GuidedContentInstallStatus;
  destination?: string;
  filename?: string;
  usedUrl?: string;
  issues: GuidedContentInstallIssue[];
}

export type ModInstallResult = LegacyModInstallResult | GuidedContentInstallResult;

export function isManifestManagedContentType(contentType?: ContentType): boolean {
  return (contentType ?? 'mod') === 'mod';
}
