export interface ModsAPI {
  searchMods: (query: unknown) => Promise<unknown>;
  getModVersions: (query: unknown) => Promise<unknown>;
  installModFile: (req: unknown) => Promise<unknown>;
}

