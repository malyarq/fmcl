import { ipcRenderer } from 'electron'
import type { DatapacksAPI } from '@shared/contracts'

export const datapacks: DatapacksAPI = {
  list: (instancePath, worldFolder) => ipcRenderer.invoke('datapacks:list', instancePath, worldFolder),
  enable: (instancePath, worldFolder, fileName) => ipcRenderer.invoke('datapacks:enable', instancePath, worldFolder, fileName),
  disable: (instancePath, worldFolder, fileName) => ipcRenderer.invoke('datapacks:disable', instancePath, worldFolder, fileName),
  delete: (instancePath, worldFolder, fileName) => ipcRenderer.invoke('datapacks:delete', instancePath, worldFolder, fileName),
  search: (query, mcVersion) => ipcRenderer.invoke('datapacks:search', query, mcVersion),
  install: (instancePath, worldFolder, versionId) => ipcRenderer.invoke('datapacks:install', instancePath, worldFolder, versionId),
  getVersions: (projectId) => ipcRenderer.invoke('datapacks:getVersions', projectId),
}
