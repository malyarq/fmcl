import { ipcRenderer } from 'electron'
import type { ShadersAPI } from '@shared/contracts'

export const shaders: ShadersAPI = {
  list: (instanceId) => ipcRenderer.invoke('shaders:list', instanceId),
  setActive: (shaderName, instanceId) => ipcRenderer.invoke('shaders:setActive', shaderName, instanceId),
  disable: (instanceId) => ipcRenderer.invoke('shaders:disable', instanceId),
  delete: (fileName, instanceId) => ipcRenderer.invoke('shaders:delete', fileName, instanceId),
  openFolder: (instanceId) => ipcRenderer.invoke('shaders:openFolder', instanceId),
  add: (instanceId) => ipcRenderer.invoke('shaders:add', instanceId),
}
