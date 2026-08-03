import { ipcRenderer } from 'electron'
import type { WorldsAPI } from '@shared/contracts'

export const worlds: WorldsAPI = {
  list: (instancePath) => ipcRenderer.invoke('worlds:list', instancePath),
  delete: (folderName, instancePath) => ipcRenderer.invoke('worlds:delete', folderName, instancePath),
  backup: (folderName, instancePath) => ipcRenderer.invoke('worlds:backup', folderName, instancePath),
  duplicate: (folderName, instancePath) => ipcRenderer.invoke('worlds:duplicate', folderName, instancePath),
  openFolder: (folderName, instancePath) => ipcRenderer.invoke('worlds:openFolder', folderName, instancePath),
}
