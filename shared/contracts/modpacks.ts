import type { ModpackMetadata } from '../types/modpack';

export interface ModpackSearchResultItem {
  platform: 'curseforge' | 'modrinth';
  projectId: string;
  slug?: string;
  title: string;
  description?: string;
  iconUrl?: string;
  downloads?: number;
  dateCreated?: string; // ISO date string for sorting by date
  dateModified?: string; // ISO date string for sorting by date
}

export interface ModpackSearchResult {
  items: ModpackSearchResultItem[];
  total?: number;
  offset?: number;
  limit?: number;
}

export interface ModpackVersionDescriptor {
  platform: 'curseforge' | 'modrinth';
  versionId: string;
  name: string;
  versionNumber?: string;
  mcVersions: string[];
  loaders: string[];
  fileId?: number; // CurseForge fileId (same as versionId but as number)
  changelog?: string; // Changelog for the version
  files: Array<{
    url: string;
    filename: string;
    size?: number;
    sha1?: string;
  }>;
}

export interface ModpackInstallProgress {
  downloaded: number;
  total: number;
  stage: string;
}

export interface ModpackInstallResult {
  modpackId: string;
  config: unknown;
  metadata: ModpackMetadata;
}

export interface ModpacksAPI {
  listModpacks: (rootPath?: string) => Promise<Array<{ id: string; name: string; path: string; selected: boolean }>>;
  listModpacksWithMetadata: (rootPath?: string) => Promise<Array<{ id: string; name: string; path: string; selected: boolean; metadata: ModpackMetadata }>>;
  bootstrapModpacks: (seed?: unknown, rootPath?: string) => Promise<{ index: unknown; selectedId: string; config: unknown }>;
  getSelectedModpack: (rootPath?: string) => Promise<string>;
  setSelectedModpack: (modpackId: string, rootPath?: string) => Promise<{ ok: boolean }>;
  createModpack: (name: string, rootPath?: string) => Promise<{ id: string; config: unknown }>;
  renameModpack: (modpackId: string, name: string, rootPath?: string) => Promise<{ ok: boolean }>;
  duplicateModpack: (sourceId: string, name?: string, rootPath?: string) => Promise<{ id: string; config: unknown }>;
  deleteModpack: (modpackId: string, rootPath?: string) => Promise<{ ok: boolean }>;
  getModpackConfig: (modpackId: string, rootPath?: string) => Promise<unknown>;
  saveModpackConfig: (cfg: unknown, rootPath?: string) => Promise<{ ok: boolean }>;
  getModpackMetadata: (modpackId: string, rootPath?: string) => Promise<ModpackMetadata>;
  updateModpackMetadata: (modpackId: string, updates: Partial<ModpackMetadata>, rootPath?: string) => Promise<ModpackMetadata>;
  // Поиск модпаков
  searchCurseForgeModpacks: (
    query: string,
    mcVersion?: string,
    loader?: string,
    sort?: 'popularity' | 'date' | 'alphabetical',
    offset?: number,
    limit?: number,
  ) => Promise<ModpackSearchResult>;
  searchModrinthModpacks: (
    query: string,
    mcVersion?: string,
    loader?: string,
    sort?: 'popularity' | 'date' | 'alphabetical',
    offset?: number,
    limit?: number,
  ) => Promise<ModpackSearchResult>;
  getCurseForgeModpackVersions: (projectId: number) => Promise<ModpackVersionDescriptor[]>;
  getModrinthModpackVersions: (projectId: string) => Promise<ModpackVersionDescriptor[]>;
  // Установка модпаков
  installCurseForgeModpack: (
    projectId: number,
    fileId: number,
    targetModpackId?: string,
    rootPath?: string,
    onProgress?: (progress: ModpackInstallProgress) => void,
  ) => Promise<ModpackInstallResult>;
  installModrinthModpack: (
    projectId: string,
    versionId: string,
    targetModpackId?: string,
    rootPath?: string,
    onProgress?: (progress: ModpackInstallProgress) => void,
  ) => Promise<ModpackInstallResult>;
  // Фаза 4: Создание и экспорт модпаков
  exportModpackFromInstance: (
    modpackId: string,
    name: string,
    version: string,
    author?: string,
    rootPath?: string,
  ) => Promise<unknown>; // ModpackManifest
  createLocalModpack: (
    name: string,
    version: string,
    minecraftVersion: string,
    modLoader?: { type: string; version?: string },
    rootPath?: string,
  ) => Promise<{ id: string; config: unknown; metadata: ModpackMetadata }>;
  exportModpack: (
    modpackId: string,
    format: 'curseforge' | 'modrinth' | 'zip',
    outputPath: string,
    rootPath?: string,
  ) => Promise<{ ok: boolean }>;
  getModpackInfoFromFile: (filePath: string) => Promise<{
    format: 'curseforge' | 'modrinth' | 'zip' | null;
    manifest: unknown | null; // ModpackManifest
    error?: string;
  }>;
  importModpack: (
    filePath: string,
    targetModpackId?: string,
    rootPath?: string,
  ) => Promise<{ id: string; config: unknown; metadata: ModpackMetadata }>;
  addModToModpack: (
    modpackId: string,
    mod: { platform: 'curseforge' | 'modrinth'; projectId: string | number; versionId: string | number },
    rootPath?: string,
  ) => Promise<{ ok: boolean }>;
  removeModFromModpack: (
    modpackId: string,
    modPath: string,
    rootPath?: string,
  ) => Promise<{ ok: boolean }>;
  setModEnabled: (
    modpackId: string,
    modPath: string,
    enabled: boolean,
    rootPath?: string,
  ) => Promise<{ ok: boolean }>;
  updateModpackOverrides: (
    modpackId: string,
    overrides: Record<string, string>, // base64 encoded buffers
    rootPath?: string,
  ) => Promise<{ ok: boolean }>;
  // Получение списка модов в модпаке
  getModpackMods: (modpackId: string, rootPath?: string) => Promise<Array<{
    id: string;
    name: string;
    version: string;
    loaders: string[];
    deps: Array<{
      id: string;
      versionRange?: string | string[];
      optional?: boolean;
      kind: string;
    }>;
    file: {
      path: string;
      name: string;
      size: number;
      mtimeMs: number;
    };
    hash: {
      sha1: string;
    };
  }>>;
  // Резервное копирование модпака
  backupModpack: (modpackId: string, rootPath?: string) => Promise<{ backupPath: string }>;
}

