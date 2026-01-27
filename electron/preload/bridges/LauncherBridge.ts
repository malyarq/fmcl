import { ipcRenderer, type IpcRendererEvent } from 'electron'
import type { LauncherAPI, LauncherLaunchOptions, LauncherProgressEvent } from '@shared/contracts'
import type { DownloadProviderId } from '@shared/types'
import { modpacks } from './ModpacksBridge'
import { mods } from './ModsBridge'

export const launcher: LauncherAPI = {
  launch: (options: LauncherLaunchOptions) => ipcRenderer.invoke('launcher:launch', options),
  getVersionList: (providerId?: DownloadProviderId) => ipcRenderer.invoke('launcher:getVersionList', providerId),
  getForgeSupportedVersions: (providerId?: DownloadProviderId) => ipcRenderer.invoke('launcher:getForgeSupportedVersions', providerId),
  getFabricSupportedVersions: () => ipcRenderer.invoke('launcher:getFabricSupportedVersions'),
  getOptiFineSupportedVersions: () => ipcRenderer.invoke('launcher:getOptiFineSupportedVersions'),
  getNeoForgeSupportedVersions: (providerId?: DownloadProviderId) => ipcRenderer.invoke('launcher:getNeoForgeSupportedVersions', providerId),
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

/**
 * Legacy aliases kept for backward compatibility.
 * New code should use `window.instances` / `window.mods` (and renderer wrappers).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const legacy = launcher as any
legacy.searchMods = mods.searchMods
legacy.getModVersions = mods.getModVersions
legacy.installModFile = mods.installModFile
legacy.listInstances = modpacks.listModpacks
legacy.bootstrapInstances = modpacks.bootstrapModpacks
legacy.getSelectedInstance = modpacks.getSelectedModpack
legacy.setSelectedInstance = modpacks.setSelectedModpack
legacy.createInstance = modpacks.createModpack
legacy.renameInstance = modpacks.renameModpack
legacy.duplicateInstance = modpacks.duplicateModpack
legacy.deleteInstance = modpacks.deleteModpack
legacy.getInstanceConfig = modpacks.getModpackConfig
legacy.saveInstanceConfig = modpacks.saveModpackConfig
