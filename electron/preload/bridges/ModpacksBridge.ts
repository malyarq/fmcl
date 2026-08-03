import { ipcRenderer } from 'electron'
import type { ModpacksAPI } from '@shared/contracts'

// Modpacks bridge: the only renderer surface for modpack operations.
export const modpacks: ModpacksAPI = {
  listModpacks: (rootPath?: string) => ipcRenderer.invoke('modpacks:list', rootPath),
  listModpacksWithMetadata: (rootPath?: string) => ipcRenderer.invoke('modpacks:listWithMetadata', rootPath),
  bootstrapModpacks: (seed?: unknown, rootPath?: string) => ipcRenderer.invoke('modpacks:bootstrap', seed, rootPath),
  getSelectedModpack: (rootPath?: string) => ipcRenderer.invoke('modpacks:getSelected', rootPath),
  setSelectedModpack: (modpackId: string, rootPath?: string) => ipcRenderer.invoke('modpacks:setSelected', modpackId, rootPath),
  createModpack: (name: string, rootPath?: string) => ipcRenderer.invoke('modpacks:create', name, rootPath),
  renameModpack: (modpackId: string, name: string, rootPath?: string) => ipcRenderer.invoke('modpacks:rename', modpackId, name, rootPath),
  getModpackConfig: (modpackId: string, rootPath?: string) => ipcRenderer.invoke('modpacks:getConfig', modpackId, rootPath),
  saveModpackConfig: (cfg: unknown, rootPath?: string) => ipcRenderer.invoke('modpacks:saveConfig', cfg, rootPath),
  getModpackMetadata: (modpackId: string, rootPath?: string) => ipcRenderer.invoke('modpacks:getMetadata', modpackId, rootPath),
  updateModpackMetadata: (modpackId: string, updates: Partial<import('@shared/types/modpack').ModpackMetadata>, rootPath?: string) => ipcRenderer.invoke('modpacks:updateMetadata', modpackId, updates, rootPath),
  // Поиск модпаков
  searchCurseForgeModpacks: (
    query: string,
    mcVersion?: string,
    loader?: string,
    sort?: 'popularity' | 'date' | 'alphabetical',
    offset?: number,
    limit?: number,
  ) => ipcRenderer.invoke('modpacks:searchCurseForge', query, mcVersion, loader, sort, offset, limit),
  searchModrinthModpacks: (
    query: string,
    mcVersion?: string,
    loader?: string,
    sort?: 'popularity' | 'date' | 'alphabetical',
    offset?: number,
    limit?: number,
  ) => ipcRenderer.invoke('modpacks:searchModrinth', query, mcVersion, loader, sort, offset, limit),
  getCurseForgeModpackVersions: (projectId: number) => ipcRenderer.invoke('modpacks:getCurseForgeVersions', projectId),
  getModrinthModpackVersions: (projectId: string) => ipcRenderer.invoke('modpacks:getModrinthVersions', projectId),
  // Создание модпаков
  createLocalModpack: (name: string, version: string, minecraftVersion: string, modLoader?: { type: string; version?: string }, rootPath?: string) => ipcRenderer.invoke('modpacks:createLocal', name, version, minecraftVersion, modLoader, rootPath),
  createFromManifest: (manifest: unknown, rootPath?: string) => ipcRenderer.invoke('modpacks:createFromManifest', manifest, rootPath),
  getModpackInfoFromFile: (filePath: string) => ipcRenderer.invoke('modpacks:getModpackInfoFromFile', filePath),
  addModToModpack: (modpackId: string, mod: { platform: 'curseforge' | 'modrinth'; projectId: string | number; versionId: string | number }, rootPath?: string) => ipcRenderer.invoke('modpacks:addMod', modpackId, mod, rootPath),
  removeModFromModpack: (modpackId: string, modPath: string, rootPath?: string) => ipcRenderer.invoke('modpacks:removeMod', modpackId, modPath, rootPath),
  setModEnabled: (modpackId: string, modPath: string, enabled: boolean, rootPath?: string) => ipcRenderer.invoke('modpacks:setModEnabled', modpackId, modPath, enabled, rootPath),
  updateModpackOverrides: (modpackId: string, overrides: Record<string, string>, rootPath?: string) => ipcRenderer.invoke('modpacks:updateOverrides', modpackId, overrides, rootPath),
  getModpackMods: (modpackId: string, rootPath?: string) => ipcRenderer.invoke('modpacks:getMods', modpackId, rootPath),
  backupModpack: (modpackId: string, rootPath?: string) => ipcRenderer.invoke('modpacks:backup', modpackId, rootPath),
  // Резолвинг пути модпака (для frontend, когда settings.minecraftPath пуст)
  resolvePath: (modpackId: string, rootPath?: string) => ipcRenderer.invoke('modpacks:resolvePath', modpackId, rootPath),

  // Java
  scanJava: () => ipcRenderer.invoke('modpacks:scanJava'),

  // Управление контентом
  getContentStats: () => ipcRenderer.invoke('modpacks:getContentStats'),
  cleanupContent: () => ipcRenderer.invoke('modpacks:cleanupContent'),
}
