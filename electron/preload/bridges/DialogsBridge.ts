import { ipcRenderer } from 'electron'
import type { DialogsAPI } from '@shared/contracts'

export const dialogs: DialogsAPI = {
  showSaveDialog: (options) => ipcRenderer.invoke('dialog:showSaveDialog', options),
  showOpenDialog: (options) => ipcRenderer.invoke('dialog:showOpenDialog', options),
  getDesktopPath: () => ipcRenderer.invoke('dialog:getDesktopPath'),
  saveFile: (filePath, content) => ipcRenderer.invoke('app:saveFile', filePath, content),
}
