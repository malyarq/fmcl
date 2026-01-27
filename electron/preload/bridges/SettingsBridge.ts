import { ipcRenderer } from 'electron'
import type { SettingsAPI } from '@shared/contracts'

// Settings management
export const settings: SettingsAPI = {
  selectMinecraftPath: () => ipcRenderer.invoke('settings:selectMinecraftPath'),
  openMinecraftPath: (path?: string) => ipcRenderer.invoke('settings:openMinecraftPath', path),
  getDefaultMinecraftPath: () => ipcRenderer.invoke('settings:getDefaultMinecraftPath')
}
