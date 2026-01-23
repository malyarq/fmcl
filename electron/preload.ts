import { ipcRenderer, contextBridge, type IpcRendererEvent } from 'electron'

// Expose a minimal, typed surface for the renderer process.
contextBridge.exposeInMainWorld('networkAPI', {
  host: (port: number) => ipcRenderer.invoke('network:host', port),
  join: (code: string) => ipcRenderer.invoke('network:join', code),
  stop: () => ipcRenderer.invoke('network:stop'),
})

// Bridge raw IPC when higher-level wrappers are not available.
contextBridge.exposeInMainWorld('ipcRenderer', {
  on(...args: Parameters<typeof ipcRenderer.on>) {
    const [channel, listener] = args
    return ipcRenderer.on(channel, (event, ...args) => listener(event, ...args))
  },
  off(...args: Parameters<typeof ipcRenderer.off>) {
    const [channel, ...omit] = args
    return ipcRenderer.off(channel, ...omit)
  },
  send(...args: Parameters<typeof ipcRenderer.send>) {
    const [channel, ...omit] = args
    return ipcRenderer.send(channel, ...omit)
  },
  invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
    const [channel, ...omit] = args
    return ipcRenderer.invoke(channel, ...omit)
  }
})

// Launcher events and actions used by the UI.
interface LaunchOptions {
  nickname: string;
  version: string;
  ram: number;
  hideLauncher?: boolean;
  gamePath?: string;
  javaPath?: string;
  installOptifine?: boolean;
  downloadProvider?: 'mojang' | 'bmcl' | 'auto';
  autoDownloadThreads?: boolean;
  downloadThreads?: number;
  maxSockets?: number;
  useOptiFine?: boolean;
}

interface ProgressInfo {
  type: string;
  task: number;
  total: number;
}

contextBridge.exposeInMainWorld('launcher', {
  launch: (options: LaunchOptions) => ipcRenderer.invoke('launcher:launch', options),
  getVersionList: (providerId?: string) => ipcRenderer.invoke('launcher:getVersionList', providerId),
  getForgeSupportedVersions: (providerId?: string) => ipcRenderer.invoke('launcher:getForgeSupportedVersions', providerId),
  getFabricSupportedVersions: () => ipcRenderer.invoke('launcher:getFabricSupportedVersions'),
  getOptiFineSupportedVersions: () => ipcRenderer.invoke('launcher:getOptiFineSupportedVersions'),
  getNeoForgeSupportedVersions: (providerId?: string) => ipcRenderer.invoke('launcher:getNeoForgeSupportedVersions', providerId),
  onLog: (callback: (log: string) => void) => {
    const subscription = (_event: IpcRendererEvent, log: string) => callback(log)
    ipcRenderer.on('launcher:log', subscription)
    return () => ipcRenderer.removeListener('launcher:log', subscription)
  },
  onProgress: (callback: (progress: ProgressInfo) => void) => {
    const subscription = (_event: IpcRendererEvent, progress: ProgressInfo) => callback(progress)
    ipcRenderer.on('launcher:progress', subscription)
    return () => ipcRenderer.removeListener('launcher:progress', subscription)
  },
  onClose: (callback: (code: number) => void) => {
    const subscription = (_event: IpcRendererEvent, code: number) => callback(code)
    ipcRenderer.on('launcher:close', subscription)
    return () => ipcRenderer.removeListener('launcher:close', subscription)
  }
})

// Self-updater bridge (app updates).
interface UpdaterProgress {
  status: string;
  progress: number;
}

contextBridge.exposeInMainWorld('updater', {
  sync: (manifestUrl: string) => ipcRenderer.invoke('updater:sync', manifestUrl),
  onProgress: (callback: (data: UpdaterProgress) => void) => {
    const subscription = (_event: IpcRendererEvent, data: UpdaterProgress) => callback(data)
    ipcRenderer.on('updater:progress', subscription)
    return () => ipcRenderer.removeListener('updater:progress', subscription)
  }
})

// App auto-updater bridge (for updating the launcher itself).
interface UpdateInfo {
  version?: string;
  tag?: string;
  releaseDate?: string;
  releaseName?: string;
  releaseNotes?: string;
}

interface UpdateProgress {
  percent?: number;
  transferred?: number;
  total?: number;
}

contextBridge.exposeInMainWorld('appUpdater', {
  check: () => ipcRenderer.invoke('app-updater:check'),
  quitAndInstall: () => ipcRenderer.invoke('app-updater:quit-and-install'),
  onStatus: (callback: (status: string) => void) => {
    const subscription = (_event: IpcRendererEvent, status: string) => callback(status)
    ipcRenderer.on('app-updater:status', subscription)
    return () => ipcRenderer.removeListener('app-updater:status', subscription)
  },
  onAvailable: (callback: (info: UpdateInfo) => void) => {
    const subscription = (_event: IpcRendererEvent, info: UpdateInfo) => callback(info)
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
  onProgress: (callback: (progress: UpdateProgress) => void) => {
    const subscription = (_event: IpcRendererEvent, progress: UpdateProgress) => callback(progress)
    ipcRenderer.on('app-updater:progress', subscription)
    return () => ipcRenderer.removeListener('app-updater:progress', subscription)
  },
  onDownloaded: (callback: (info: UpdateInfo) => void) => {
    const subscription = (_event: IpcRendererEvent, info: UpdateInfo) => callback(info)
    ipcRenderer.on('app-updater:downloaded', subscription)
    return () => ipcRenderer.removeListener('app-updater:downloaded', subscription)
  }
})

// Window control helpers for the custom title bar.
contextBridge.exposeInMainWorld('windowControls', {
  minimize: () => ipcRenderer.invoke('window:minimize'),
  close: () => ipcRenderer.invoke('window:close')
})

// Cache management
contextBridge.exposeInMainWorld('cache', {
  clear: () => ipcRenderer.invoke('launcher:clearCache'),
  reload: () => ipcRenderer.invoke('launcher:reload')
})

// Settings management
contextBridge.exposeInMainWorld('settings', {
  selectMinecraftPath: () => ipcRenderer.invoke('settings:selectMinecraftPath'),
  openMinecraftPath: (path?: string) => ipcRenderer.invoke('settings:openMinecraftPath', path),
  getDefaultMinecraftPath: () => ipcRenderer.invoke('settings:getDefaultMinecraftPath')
})

// Get static asset path (for images, etc.)
contextBridge.exposeInMainWorld('assets', {
  getIconPath: () => ipcRenderer.invoke('assets:getIconPath')
})
