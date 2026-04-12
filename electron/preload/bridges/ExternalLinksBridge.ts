import { ipcRenderer } from 'electron'
import type { ExternalLinksAPI } from '@shared/contracts/externalLinks'

export const ExternalLinksBridge: ExternalLinksAPI = {
  open: (request) => ipcRenderer.invoke('externalLinks:open', request),
}
