import { contextBridge } from 'electron'
import { assets } from './preload/bridges/AssetsBridge'
import { appUpdater } from './preload/bridges/AppUpdaterBridge'
import { cache } from './preload/bridges/CacheBridge'
import { ipcRendererBridge } from './preload/bridges/IpcRendererBridge'
import { modpacks } from './preload/bridges/ModpacksBridge'
import { launcher } from './preload/bridges/LauncherBridge'
import { mods } from './preload/bridges/ModsBridge'
import { networkAPI } from './preload/bridges/NetworkBridge'
import { settings } from './preload/bridges/SettingsBridge'
import { updater } from './preload/bridges/UpdaterBridge'
import { windowControls } from './preload/bridges/WindowControlsBridge'
import type { FriendLauncherApi } from '@shared/contracts'

// Expose a minimal, typed surface for the renderer process.
contextBridge.exposeInMainWorld('networkAPI', networkAPI)
contextBridge.exposeInMainWorld('ipcRenderer', ipcRendererBridge)
contextBridge.exposeInMainWorld('launcher', launcher)
contextBridge.exposeInMainWorld('modpacks', modpacks)
contextBridge.exposeInMainWorld('mods', mods)
contextBridge.exposeInMainWorld('updater', updater)
contextBridge.exposeInMainWorld('appUpdater', appUpdater)
contextBridge.exposeInMainWorld('windowControls', windowControls)
contextBridge.exposeInMainWorld('cache', cache)
contextBridge.exposeInMainWorld('settings', settings)
contextBridge.exposeInMainWorld('assets', assets)

// Unified namespace (preferred for new code). Existing `window.*` globals remain as aliases.
const api: FriendLauncherApi = {
  launcher,
  modpacks,
  mods,
  updater,
  appUpdater,
  windowControls,
  network: networkAPI,
  cache,
  settings,
  assets,
  ipcRenderer: ipcRendererBridge,
}

contextBridge.exposeInMainWorld('api', api)
