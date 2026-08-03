import { ipcRenderer, type IpcRendererEvent } from 'electron'
import type { LauncherAPI, LauncherLaunchOptions, LauncherProgressEvent } from '@shared/contracts'
import type { DownloadProviderId } from '@shared/types'

export const launcher: LauncherAPI = {
  launch: (options: LauncherLaunchOptions) => ipcRenderer.invoke('launcher:launch', options),
  killAndRestart: () => ipcRenderer.invoke('launcher:killAndRestart'),
  getVersionList: (providerId?: DownloadProviderId) => ipcRenderer.invoke('launcher:getVersionList', providerId),
  getForgeSupportedVersions: (providerId?: DownloadProviderId) => ipcRenderer.invoke('launcher:getForgeSupportedVersions', providerId),
  getFabricSupportedVersions: () => ipcRenderer.invoke('launcher:getFabricSupportedVersions'),
  getOptiFineSupportedVersions: () => ipcRenderer.invoke('launcher:getOptiFineSupportedVersions'),
  getNeoForgeSupportedVersions: (providerId?: DownloadProviderId) => ipcRenderer.invoke('launcher:getNeoForgeSupportedVersions', providerId),
  sendStdin: (data: string) => ipcRenderer.invoke('launcher:stdin', data),
  onLog: (callback: (log: string) => void) => {
    const subscription = (_event: IpcRendererEvent, log: string) => callback(log)
    ipcRenderer.on('launcher:log', subscription)
    return () => ipcRenderer.removeListener('launcher:log', subscription)
  },
  onProgress: (callback: (progress: LauncherProgressEvent) => void) => {
    const subscription = (_event: IpcRendererEvent, progress: LauncherProgressEvent) => callback(progress)
    ipcRenderer.on('launcher:progress', subscription)
    return () => ipcRenderer.removeListener('launcher:progress', subscription)
  },
  onClose: (callback: (code: number) => void) => {
    const subscription = (_event: IpcRendererEvent, code: number) => callback(code)
    ipcRenderer.on('launcher:close', subscription)
    return () => ipcRenderer.removeListener('launcher:close', subscription)
  }
}
