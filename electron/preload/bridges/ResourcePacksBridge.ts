import { ipcRenderer } from 'electron'
import type { ResourcePacksAPI } from '@shared/contracts'

export const resourcePacks: ResourcePacksAPI = {
  list: (instanceId) => ipcRenderer.invoke('resourcePacks:list', instanceId),
  enable: (instanceId, fileName) => ipcRenderer.invoke('resourcePacks:enable', instanceId, fileName),
  disable: (instanceId, fileName) => ipcRenderer.invoke('resourcePacks:disable', instanceId, fileName),
  reorder: (instanceId, fileNames) => ipcRenderer.invoke('resourcePacks:reorder', instanceId, fileNames),
  delete: (instanceId, fileName) => ipcRenderer.invoke('resourcePacks:delete', instanceId, fileName),
  openFolder: (instanceId) => ipcRenderer.invoke('resourcePacks:openFolder', instanceId),
  add: (instanceId) => ipcRenderer.invoke('resourcePacks:add', instanceId),
}
