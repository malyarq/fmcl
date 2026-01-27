import { ipcRenderer } from 'electron'
import type { CacheAPI } from '@shared/contracts'

// Cache management
export const cache: CacheAPI = {
  clear: () => ipcRenderer.invoke('launcher:clearCache'),
  reload: () => ipcRenderer.invoke('launcher:reload')
}
