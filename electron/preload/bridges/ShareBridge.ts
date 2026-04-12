import { ipcRenderer } from 'electron'
import type { ShareAPI } from '@shared/contracts/share'

export const ShareBridge: ShareAPI = {
  generateCode: (modpackId: string) => ipcRenderer.invoke('share:generateCode', modpackId),
  importCode: (code: string) => ipcRenderer.invoke('share:importCode', code),
}
