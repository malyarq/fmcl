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
import { ScreenshotsBridge } from './preload/bridges/ScreenshotsBridge'
import { AccountBridge } from './preload/bridges/AccountBridge'
import { MirrorsBridge } from './preload/bridges/MirrorsBridge'
import { statistics } from './preload/bridges/StatisticsBridge'
import { ShareBridge } from './preload/bridges/ShareBridge'
import { ExternalLinksBridge } from './preload/bridges/ExternalLinksBridge'
import { resourcePacks } from './preload/bridges/ResourcePacksBridge'
import { shaders } from './preload/bridges/ShadersBridge'
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
contextBridge.exposeInMainWorld('screenshots', ScreenshotsBridge)
contextBridge.exposeInMainWorld('account', AccountBridge)
contextBridge.exposeInMainWorld('mirrors', MirrorsBridge)
contextBridge.exposeInMainWorld('share', ShareBridge)
contextBridge.exposeInMainWorld('externalLinks', ExternalLinksBridge)

// Unified namespace (supported for renderer code). Legacy `window.*` globals remain as aliases.
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
  resourcePacks,
  shaders,
  ipcRenderer: ipcRendererBridge,
  account: AccountBridge,
  mirrors: MirrorsBridge,
  statistics,
  share: ShareBridge,
  externalLinks: ExternalLinksBridge,
}

contextBridge.exposeInMainWorld('api', api)
