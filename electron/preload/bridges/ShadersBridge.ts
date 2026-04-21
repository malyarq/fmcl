import { ipcRenderer } from 'electron'
import type { ShadersAPI } from '@shared/contracts'

export const shaders: ShadersAPI = {
  list: (instancePath) => ipcRenderer.invoke('shaders:list', instancePath),
  setActive: (shaderName, instancePath) => ipcRenderer.invoke('shaders:setActive', shaderName, instancePath),
  disable: (instancePath) => ipcRenderer.invoke('shaders:disable', instancePath),
  delete: (fileName, instancePath) => ipcRenderer.invoke('shaders:delete', fileName, instancePath),
  openFolder: (instancePath) => ipcRenderer.invoke('shaders:openFolder', instancePath),
  add: (instancePath) => ipcRenderer.invoke('shaders:add', instancePath),
}
