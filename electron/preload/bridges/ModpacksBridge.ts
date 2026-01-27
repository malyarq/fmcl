import { ipcRenderer } from 'electron'
import type { ModpacksAPI } from '@shared/contracts'

// Modpacks bridge (separate domain surface; prefer this over window.launcher modpack methods).
export const modpacks: ModpacksAPI = {
  listModpacks: (rootPath?: string) => ipcRenderer.invoke('modpacks:list', rootPath),
  listModpacksWithMetadata: (rootPath?: string) => ipcRenderer.invoke('modpacks:listWithMetadata', rootPath),
  bootstrapModpacks: (seed?: unknown, rootPath?: string) => ipcRenderer.invoke('modpacks:bootstrap', seed, rootPath),
  getSelectedModpack: (rootPath?: string) => ipcRenderer.invoke('modpacks:getSelected', rootPath),
  setSelectedModpack: (modpackId: string, rootPath?: string) => ipcRenderer.invoke('modpacks:setSelected', modpackId, rootPath),
  createModpack: (name: string, rootPath?: string) => ipcRenderer.invoke('modpacks:create', name, rootPath),
  renameModpack: (modpackId: string, name: string, rootPath?: string) => ipcRenderer.invoke('modpacks:rename', modpackId, name, rootPath),
  duplicateModpack: (sourceId: string, name?: string, rootPath?: string) => ipcRenderer.invoke('modpacks:duplicate', sourceId, name, rootPath),
  deleteModpack: (modpackId: string, rootPath?: string) => ipcRenderer.invoke('modpacks:delete', modpackId, rootPath),
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
  // Установка модпаков
  installCurseForgeModpack: (projectId: number, fileId: number, targetModpackId?: string, rootPath?: string) => ipcRenderer.invoke('modpacks:installCurseForge', projectId, fileId, targetModpackId, rootPath),
  installModrinthModpack: (projectId: string, versionId: string, targetModpackId?: string, rootPath?: string) => ipcRenderer.invoke('modpacks:installModrinth', projectId, versionId, targetModpackId, rootPath),
  // Фаза 4: Создание и экспорт модпаков
  exportModpackFromInstance: (modpackId: string, name: string, version: string, author?: string, rootPath?: string) => ipcRenderer.invoke('modpacks:exportFromInstance', modpackId, name, version, author, rootPath),
  createLocalModpack: (name: string, version: string, minecraftVersion: string, modLoader?: { type: string; version?: string }, rootPath?: string) => ipcRenderer.invoke('modpacks:createLocal', name, version, minecraftVersion, modLoader, rootPath),
  exportModpack: (modpackId: string, format: 'curseforge' | 'modrinth' | 'zip', outputPath: string, rootPath?: string) => ipcRenderer.invoke('modpacks:export', modpackId, format, outputPath, rootPath),
  getModpackInfoFromFile: (filePath: string) => ipcRenderer.invoke('modpacks:getModpackInfoFromFile', filePath),
  importModpack: (filePath: string, targetModpackId?: string, rootPath?: string) => ipcRenderer.invoke('modpacks:import', filePath, targetModpackId, rootPath),
  addModToModpack: (modpackId: string, mod: { platform: 'curseforge' | 'modrinth'; projectId: string | number; versionId: string | number }, rootPath?: string) => ipcRenderer.invoke('modpacks:addMod', modpackId, mod, rootPath),
  removeModFromModpack: (modpackId: string, modPath: string, rootPath?: string) => ipcRenderer.invoke('modpacks:removeMod', modpackId, modPath, rootPath),
  updateModpackOverrides: (modpackId: string, overrides: Record<string, string>, rootPath?: string) => ipcRenderer.invoke('modpacks:updateOverrides', modpackId, overrides, rootPath),
  getModpackMods: (modpackId: string, rootPath?: string) => ipcRenderer.invoke('modpacks:getMods', modpackId, rootPath),
  backupModpack: (modpackId: string, rootPath?: string) => ipcRenderer.invoke('modpacks:backup', modpackId, rootPath),
}

