import { ipcRenderer } from 'electron'
import type { ModInstallRequest, ModsAPI } from '@shared/contracts'

// Mods bridge: the only renderer surface for mod discovery and installation.
export const mods: ModsAPI = {
  searchMods: (query: unknown) => ipcRenderer.invoke('mods:searchMods', query),
  getModVersions: (query: unknown) => ipcRenderer.invoke('mods:getModVersions', query),
  installModFile: (req: ModInstallRequest) => ipcRenderer.invoke('mods:installModFile', req),
}
