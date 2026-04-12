import { ipcRenderer } from 'electron'
import type { CacheAPI } from '@shared/contracts'

// Cache management
export const cache: CacheAPI = {
  clear: () => ipcRenderer.invoke('launcher:clearCache'),
  reload: () => ipcRenderer.invoke('launcher:reload'),
  getImageCacheState: () => ipcRenderer.invoke('cache:getImageState'),
  setImageCacheLimit: (maxSizeBytes) => ipcRenderer.invoke('cache:setImageLimit', maxSizeBytes),
  cleanupImageCache: () => ipcRenderer.invoke('cache:cleanupImage'),
  resolveImage: (sourceUrl) => ipcRenderer.invoke('cache:resolveImage', sourceUrl),
}
