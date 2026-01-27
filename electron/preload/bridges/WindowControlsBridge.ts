import { ipcRenderer } from 'electron'
import type { WindowControlsAPI } from '@shared/contracts'

// Window control helpers for the custom title bar.
export const windowControls: WindowControlsAPI = {
  minimize: () => ipcRenderer.invoke('window:minimize'),
  close: () => ipcRenderer.invoke('window:close')
}
