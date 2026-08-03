import type { ModpackMetadata } from '../types/modpack';
import type { ModEntry } from '../types/mods';

export interface ModpackSearchResultItem {
  platform: 'curseforge' | 'modrinth';
  projectId: string;
  slug?: string;
  title: string;
  description?: string;
  iconUrl?: string;
  minecraftVersion?: string;
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

export interface ModpacksAPI {
  listModpacks: (rootPath?: string) => Promise<Array<{ id: string; name: string; path: string; selected: boolean }>>;
  listModpacksWithMetadata: (rootPath?: string) => Promise<Array<{ id: string; name: string; path: string; selected: boolean; metadata: ModpackMetadata }>>;
  bootstrapModpacks: (seed?: unknown, rootPath?: string) => Promise<{ index: unknown; selectedId: string; config: unknown }>;
  getSelectedModpack: (rootPath?: string) => Promise<string>;
  setSelectedModpack: (modpackId: string, rootPath?: string) => Promise<{ ok: boolean }>;
  createModpack: (name: string, rootPath?: string) => Promise<{ id: string; config: unknown }>;
  renameModpack: (modpackId: string, name: string, rootPath?: string) => Promise<{ ok: boolean }>;
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
  // Создание модпаков
  createLocalModpack: (
    name: string,
    version: string,
    minecraftVersion: string,
    modLoader?: { type: string; version?: string },
    rootPath?: string,
  ) => Promise<{ id: string; config: unknown; metadata: ModpackMetadata }>;
  createFromManifest: (
    manifest: unknown, // ModpackManifest
    rootPath?: string,
  ) => Promise<{ id: string }>;
  getModpackInfoFromFile: (filePath: string) => Promise<{
    format: 'curseforge' | 'modrinth' | 'zip' | null;
    manifest: unknown | null; // ModpackManifest
    error?: string;
  }>;
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
  getModpackMods: (modpackId: string, rootPath?: string) => Promise<ModEntry[]>;
  // Резервное копирование модпака
  backupModpack: (modpackId: string, rootPath?: string) => Promise<{ backupPath: string }>;
  resolvePath: (modpackId: string, rootPath?: string) => Promise<string>;

  // Java
  scanJava: () => Promise<DetectedJava[]>;

  // Управление контентом
  getContentStats: () => Promise<{ totalSize: number; dedupedSize: number; totalFiles: number; storedFiles: number }>;
  cleanupContent: () => Promise<{ freedSize: number; deletedFiles: number }>;
}

export interface DetectedJava {
  path: string;
  version: string;
  majorVersion: number;
  valid: boolean;
  arch?: string; // x86, x64, arm64
}
