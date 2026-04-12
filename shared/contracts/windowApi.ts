import type { AppUpdaterAPI } from './appUpdater'
import type { AssetsAPI } from './assets'
import type { CacheAPI } from './cache'
import type { InstanceUpdaterAPI } from './updater'
import type { IpcRendererAPI } from './ipcRenderer'
import type { ModpacksAPI } from './modpacks'
import type { LauncherAPI } from './launcher'
import type { ModsAPI } from './mods'
import type { NetworkAPI } from './network'
import type { SettingsAPI } from './settings'
import type { WindowControlsAPI } from './windowControls'
import type { AccountAPI } from './account'
import type { MirrorsAPI } from './mirrors'
import type { StatisticsAPI } from './statistics'
import type { ShareAPI } from './share'
import type { ExternalLinksAPI } from './externalLinks'

/**
 * Supported, namespaced preload surface for renderer code.
 *
 * Legacy `window.*` globals remain available only as compatibility aliases.
 */
export type FriendLauncherApi = {
  launcher: LauncherAPI
  modpacks: ModpacksAPI
  mods: ModsAPI
  updater: InstanceUpdaterAPI
  windowControls: WindowControlsAPI
  network: NetworkAPI
  cache: CacheAPI
  settings: SettingsAPI
  assets: AssetsAPI
  appUpdater: AppUpdaterAPI
  ipcRenderer: IpcRendererAPI
  account: AccountAPI
  mirrors: MirrorsAPI
  statistics: StatisticsAPI
  share: ShareAPI
  externalLinks: ExternalLinksAPI
}
