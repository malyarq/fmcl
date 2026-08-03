import type { FriendLauncherApi } from '@shared/contracts';
import type { ModpackMetadata } from '@shared/types/modpack';
import type { ModpackConfig, ModpackListItem } from '../../contexts/instances/types';
import { toIpcError } from './ipcError';

type ModpacksApi = FriendLauncherApi['modpacks'];

function api(): ModpacksApi {
  const modpacks = typeof window !== 'undefined' ? window.api?.modpacks : undefined;
  if (!modpacks) {
    throw new Error('[modpacksIPC] modpacks API is not available');
  }
  return modpacks;
}

async function call<T>(method: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    const ipcError = toIpcError({ namespace: 'modpacksIPC', method }, error);
    console.error(ipcError);
    throw ipcError;
  }
}

export const modpacksIPC = {
  isAvailable: () => typeof window !== 'undefined' && Boolean(window.api?.modpacks),
  list: (rootPath?: string) => call(
    'listModpacks',
    () => api().listModpacks(rootPath) as Promise<ModpackListItem[]>,
  ),
  listWithMetadata: (rootPath?: string) => call(
    'listModpacksWithMetadata',
    () => api().listModpacksWithMetadata(rootPath),
  ),
  bootstrap: (seed?: Partial<ModpackConfig>, rootPath?: string) => call(
    'bootstrapModpacks',
    () => api().bootstrapModpacks(seed, rootPath) as Promise<{
      index?: unknown;
      selectedId?: string;
      config?: ModpackConfig;
    }>,
  ),
  getSelected: (rootPath?: string) => call(
    'getSelectedModpack',
    () => api().getSelectedModpack(rootPath) as Promise<string | null>,
  ),
  setSelected: (id: string, rootPath?: string) => call(
    'setSelectedModpack',
    () => api().setSelectedModpack(id, rootPath),
  ),
  create: (name: string, rootPath?: string) => call(
    'createModpack',
    () => api().createModpack(name, rootPath) as Promise<{ id?: string; config?: ModpackConfig }>,
  ),
  rename: (id: string, name: string, rootPath?: string) => call(
    'renameModpack',
    () => api().renameModpack(id, name, rootPath),
  ),
  getConfig: (id: string, rootPath?: string) => call(
    'getModpackConfig',
    () => api().getModpackConfig(id, rootPath) as Promise<ModpackConfig | null>,
  ),
  saveConfig: (cfg: ModpackConfig, rootPath?: string) => call(
    'saveModpackConfig',
    () => api().saveModpackConfig(cfg, rootPath),
  ),
  getMetadata: (modpackId: string, rootPath?: string) => call(
    'getModpackMetadata',
    () => api().getModpackMetadata(modpackId, rootPath),
  ),
  updateMetadata: (modpackId: string, updates: Partial<ModpackMetadata>, rootPath?: string) => call(
    'updateModpackMetadata',
    () => api().updateModpackMetadata(modpackId, updates, rootPath),
  ),
  scanJava: () => call('scanJava', () => api().scanJava()),
  searchCurseForge: (
    query: string,
    mcVersion?: string,
    loader?: string,
    sort?: 'popularity' | 'date' | 'alphabetical',
    offset?: number,
    limit?: number,
  ) => call(
    'searchCurseForgeModpacks',
    () => api().searchCurseForgeModpacks(query, mcVersion, loader, sort, offset, limit),
  ),
  searchModrinth: (
    query: string,
    mcVersion?: string,
    loader?: string,
    sort?: 'popularity' | 'date' | 'alphabetical',
    offset?: number,
    limit?: number,
  ) => call(
    'searchModrinthModpacks',
    () => api().searchModrinthModpacks(query, mcVersion, loader, sort, offset, limit),
  ),
  getCurseForgeVersions: (projectId: number) => call(
    'getCurseForgeModpackVersions',
    () => api().getCurseForgeModpackVersions(projectId),
  ),
  getModrinthVersions: (projectId: string) => call(
    'getModrinthModpackVersions',
    () => api().getModrinthModpackVersions(projectId),
  ),
  getModpackInfoFromFile: (filePath: string) => call(
    'getModpackInfoFromFile',
    () => api().getModpackInfoFromFile(filePath),
  ),
  createFromManifest: (manifest: unknown, rootPath?: string) => call(
    'createFromManifest',
    () => api().createFromManifest(manifest, rootPath),
  ),
  createLocal: (
    name: string,
    version: string,
    minecraftVersion: string,
    modLoader?: { type: string; version?: string },
    rootPath?: string,
  ) => call(
    'createLocalModpack',
    () => api().createLocalModpack(name, version, minecraftVersion, modLoader, rootPath),
  ),
  getMods: (modpackId: string, rootPath?: string) => call(
    'getModpackMods',
    () => api().getModpackMods(modpackId, rootPath),
  ),
  removeMod: (modpackId: string, modPath: string, rootPath?: string) => call(
    'removeModFromModpack',
    () => api().removeModFromModpack(modpackId, modPath, rootPath),
  ),
  setModEnabled: (modpackId: string, modPath: string, enabled: boolean, rootPath?: string) => call(
    'setModEnabled',
    () => api().setModEnabled(modpackId, modPath, enabled, rootPath),
  ),
  backup: (modpackId: string, rootPath?: string) => call(
    'backupModpack',
    () => api().backupModpack(modpackId, rootPath),
  ),
  addMod: (
    modpackId: string,
    mod: { platform: 'curseforge' | 'modrinth'; projectId: string | number; versionId: string | number },
    rootPath?: string,
  ) => call(
    'addModToModpack',
    () => api().addModToModpack(modpackId, mod, rootPath),
  ),
  resolvePath: (id: string, rootPath?: string) => call(
    'resolvePath',
    () => api().resolvePath(id, rootPath),
  ),
  getContentStats: () => call('getContentStats', () => api().getContentStats()),
  cleanupContent: () => call('cleanupContent', () => api().cleanupContent()),
};

export type ModpacksIPC = typeof modpacksIPC;
