import { ipcRenderer, type IpcRendererEvent } from 'electron'
import type { InstanceUpdaterAPI, InstanceUpdaterProgress, InstanceUpdaterSyncOptions } from '@shared/contracts'

// Self-updater bridge (app updates).
export const updater: InstanceUpdaterAPI = {
  sync: (manifestUrl: string, optionsOrRootPath?: InstanceUpdaterSyncOptions | string) =>
    ipcRenderer.invoke('updater:sync', manifestUrl, optionsOrRootPath),
  onProgress: (callback: (data: InstanceUpdaterProgress) => void) => {
    const subscription = (_event: IpcRendererEvent, data: InstanceUpdaterProgress) => callback(data)
    ipcRenderer.on('updater:progress', subscription)
    return () => ipcRenderer.removeListener('updater:progress', subscription)
  }
}
