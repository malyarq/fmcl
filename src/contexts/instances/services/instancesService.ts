import type { ModpackConfig, ModpackListItem } from '../types';
import { modpacksIPC } from '../../../services/ipc/modpacksIPC';
import { buildLegacySeedFromLocalStorage } from './legacySeed';

export async function fetchModpackConfig(id: string, rootPath?: string): Promise<ModpackConfig | null> {
  return await modpacksIPC.getConfig(id, rootPath);
}

export async function listModpacks(rootPath?: string): Promise<ModpackListItem[]> {
  return await modpacksIPC.list(rootPath);
}

export async function getSelectedModpackId(rootPath?: string): Promise<string | null> {
  return await modpacksIPC.getSelected(rootPath);
}

export async function setSelectedModpackId(id: string, rootPath?: string): Promise<void> {
  await modpacksIPC.setSelected(id, rootPath);
}

export async function createModpack(name: string, rootPath?: string): Promise<{ id?: string } | null> {
  return await modpacksIPC.create(name, rootPath);
}

export async function renameModpack(id: string, name: string, rootPath?: string): Promise<void> {
  await modpacksIPC.rename(id, name, rootPath);
}

export async function duplicateModpack(sourceId: string, name?: string, rootPath?: string): Promise<{ id?: string } | null> {
  return await modpacksIPC.duplicate(sourceId, name, rootPath);
}

export async function deleteModpack(id: string, rootPath?: string): Promise<void> {
  await modpacksIPC.remove(id, rootPath);
}

export async function saveModpackConfig(cfg: ModpackConfig, rootPath?: string): Promise<void> {
  await modpacksIPC.saveConfig(cfg, rootPath);
}

/**
 * Bootstraps modpacks in main process (if supported) using legacy localStorage seed.
 * Returns null if bootstrap is not available.
 */
export async function bootstrapModpacksIfSupported(rootPath?: string): Promise<{ selectedId: string; config: ModpackConfig } | null> {
  // `modpacksIPC.bootstrap` is a no-op if the method isn't present.
  // Detect support by checking if launcher has the method via behavior: if it returns empty object, treat as unsupported.
  const seed = buildLegacySeedFromLocalStorage();
  const res = await modpacksIPC.bootstrap(seed, rootPath);
  if (!res || !res.config) return null;
  return { selectedId: res.selectedId || 'default', config: res.config as ModpackConfig };
}

// Legacy aliases for backward compatibility during migration
export const fetchInstanceConfig = fetchModpackConfig;
export const listInstances = listModpacks;
export const getSelectedInstanceId = getSelectedModpackId;
export const setSelectedInstanceId = setSelectedModpackId;
export const createInstance = createModpack;
export const renameInstance = renameModpack;
export const duplicateInstance = duplicateModpack;
export const deleteInstance = deleteModpack;
export const saveInstanceConfig = saveModpackConfig;
export const bootstrapInstancesIfSupported = bootstrapModpacksIfSupported;

