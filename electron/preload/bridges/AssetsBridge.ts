import { ipcRenderer } from 'electron'
import type { AssetsAPI } from '@shared/contracts'

// Get static asset path (for images, etc.)
export const assets: AssetsAPI = {
  getIconPath: () => ipcRenderer.invoke('assets:getIconPath')
}
