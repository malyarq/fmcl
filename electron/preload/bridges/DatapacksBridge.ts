import { ipcRenderer } from 'electron'
import type { DatapacksAPI } from '@shared/contracts'

export const datapacks: DatapacksAPI = {
  search: (query, mcVersion) => ipcRenderer.invoke('datapacks:search', query, mcVersion),
  getVersions: (projectId) => ipcRenderer.invoke('datapacks:getVersions', projectId),
  listByInstanceId: (instanceId, worldFolder) => ipcRenderer.invoke('datapacks:listByInstanceId', instanceId, worldFolder),
  enableByInstanceId: (instanceId, worldFolder, fileName) => ipcRenderer.invoke('datapacks:enableByInstanceId', instanceId, worldFolder, fileName),
  disableByInstanceId: (instanceId, worldFolder, fileName) => ipcRenderer.invoke('datapacks:disableByInstanceId', instanceId, worldFolder, fileName),
  deleteByInstanceId: (instanceId, worldFolder, fileName) => ipcRenderer.invoke('datapacks:deleteByInstanceId', instanceId, worldFolder, fileName),
  installByInstanceId: (instanceId, worldFolder, versionId) => ipcRenderer.invoke('datapacks:installByInstanceId', instanceId, worldFolder, versionId),
}
