import { ipcRenderer, type IpcRendererEvent } from 'electron'
import type { AppUpdaterAPI, AppUpdaterAvailableInfo, AppUpdaterProgress } from '@shared/contracts'

// App auto-updater bridge (for updating the launcher itself).
export const appUpdater: AppUpdaterAPI = {
  check: () => ipcRenderer.invoke('app-updater:check'),
  quitAndInstall: () => {
    void ipcRenderer.invoke('app-updater:quit-and-install')
  },
  onStatus: (callback: (status: string) => void) => {
    const subscription = (_event: IpcRendererEvent, status: string) => callback(status)
    ipcRenderer.on('app-updater:status', subscription)
    return () => ipcRenderer.removeListener('app-updater:status', subscription)
  },
  onAvailable: (callback: (info: AppUpdaterAvailableInfo) => void) => {
    const subscription = (_event: IpcRendererEvent, info: AppUpdaterAvailableInfo) => callback(info)
    ipcRenderer.on('app-updater:available', subscription)
    return () => ipcRenderer.removeListener('app-updater:available', subscription)
  },
  onNotAvailable: (callback: (info: unknown) => void) => {
    const subscription = (_event: IpcRendererEvent, info: unknown) => callback(info)
    ipcRenderer.on('app-updater:not-available', subscription)
    return () => ipcRenderer.removeListener('app-updater:not-available', subscription)
  },
  onError: (callback: (error: string) => void) => {
    const subscription = (_event: IpcRendererEvent, error: string) => callback(error)
    ipcRenderer.on('app-updater:error', subscription)
    return () => ipcRenderer.removeListener('app-updater:error', subscription)
  },
  onProgress: (callback: (progress: AppUpdaterProgress) => void) => {
    const subscription = (_event: IpcRendererEvent, progress: AppUpdaterProgress) => callback(progress)
    ipcRenderer.on('app-updater:progress', subscription)
    return () => ipcRenderer.removeListener('app-updater:progress', subscription)
  },
  onDownloaded: (callback: (info: { version?: string }) => void) => {
    const subscription = (_event: IpcRendererEvent, info: { version?: string }) => callback(info)
    ipcRenderer.on('app-updater:downloaded', subscription)
    return () => ipcRenderer.removeListener('app-updater:downloaded', subscription)
  }
}
