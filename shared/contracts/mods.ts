export type ModInstallContentType = 'mod' | 'resourcepack' | 'shader';

/**
 * Renderer-safe provider install request. Main owns the launcher root and all
 * resulting filesystem paths; callers can identify only a canonical instance
 * and provider content.
 */
export interface ModInstallRequest {
  instanceId: string;
  platform: 'curseforge' | 'modrinth';
  projectId: string;
  versionId: string;
  contentType: ModInstallContentType;
}

export type ModInstallStatus = 'success' | 'duplicate' | 'invalid-archive' | 'runtime-blocked' | 'failure';

export interface ModInstallIssue {
  fileName: string;
  status: Exclude<ModInstallStatus, 'success'>;
  message: string;
}

/** Deliberately path-free public result for provider-backed content installs. */
export interface ModInstallResponse {
  status: ModInstallStatus;
  filename?: string;
  issues: ModInstallIssue[];
}

export interface ModsAPI {
  searchMods: (query: unknown) => Promise<unknown>;
  getModVersions: (query: unknown) => Promise<unknown>;
  installModFile: (req: ModInstallRequest) => Promise<ModInstallResponse>;
}
