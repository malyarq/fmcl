import { ipcRenderer } from 'electron'
import type { ModsAPI } from '@shared/contracts'

// Mods bridge (separate domain surface; prefer this over window.launcher mods methods).
export const mods: ModsAPI = {
  searchMods: (query: unknown) => ipcRenderer.invoke('mods:searchMods', query),
  getModVersions: (query: unknown) => ipcRenderer.invoke('mods:getModVersions', query),
  installModFile: (req: unknown) => ipcRenderer.invoke('mods:installModFile', req),
}

