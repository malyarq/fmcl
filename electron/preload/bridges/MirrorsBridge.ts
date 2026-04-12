import { ipcRenderer } from 'electron'
import type { MirrorsAPI } from '@shared/contracts'

export const MirrorsBridge: MirrorsAPI = {
  getMirrors: async () => ipcRenderer.invoke('mirrors:getMirrors'),
  getSelectedMirror: async () => ipcRenderer.invoke('mirrors:getSelectedMirror'),
  addCustomMirror: async (name, rootUrl) => ipcRenderer.invoke('mirrors:addCustomMirror', name, rootUrl),
  removeMirror: async (id) => ipcRenderer.invoke('mirrors:removeMirror', id),
  selectMirror: async (id) => ipcRenderer.invoke('mirrors:selectMirror', id),
  moveMirror: async (id, direction) => ipcRenderer.invoke('mirrors:moveMirror', id, direction),
  testSpeed: async (url) => ipcRenderer.invoke('mirrors:testSpeed', url),
  setAutoSelect: async (enabled) => ipcRenderer.invoke('mirrors:setAutoSelect', enabled),
  isAutoSelectEnabled: async () => ipcRenderer.invoke('mirrors:isAutoSelectEnabled'),
}
