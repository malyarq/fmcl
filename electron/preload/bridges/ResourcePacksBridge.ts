import { ipcRenderer } from 'electron'
import type { ResourcePacksAPI } from '@shared/contracts'

export const resourcePacks: ResourcePacksAPI = {
  list: (instancePath) => ipcRenderer.invoke('resourcePacks:list', instancePath),
  enable: (fileName, instancePath) => ipcRenderer.invoke('resourcePacks:enable', fileName, instancePath),
  disable: (fileName, instancePath) => ipcRenderer.invoke('resourcePacks:disable', fileName, instancePath),
  reorder: (fileNames, instancePath) => ipcRenderer.invoke('resourcePacks:reorder', fileNames, instancePath),
  import: (filePath, instancePath) => ipcRenderer.invoke('resourcePacks:import', filePath, instancePath),
  delete: (fileName, instancePath) => ipcRenderer.invoke('resourcePacks:delete', fileName, instancePath),
  openFolder: (instancePath) => ipcRenderer.invoke('resourcePacks:openFolder', instancePath),
  add: (instancePath) => ipcRenderer.invoke('resourcePacks:add', instancePath),
}
