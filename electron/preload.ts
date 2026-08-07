import { contextBridge } from 'electron'
import { assets } from './preload/bridges/AssetsBridge'
import { appUpdater } from './preload/bridges/AppUpdaterBridge'
import { cache } from './preload/bridges/CacheBridge'
import { launcher } from './preload/bridges/LauncherBridge'
import { mods } from './preload/bridges/ModsBridge'
import { networkAPI } from './preload/bridges/NetworkBridge'
import { settings } from './preload/bridges/SettingsBridge'
import { windowControls } from './preload/bridges/WindowControlsBridge'
import { screenshots } from './preload/bridges/ScreenshotsBridge'
import { AccountBridge } from './preload/bridges/AccountBridge'
import { MirrorsBridge } from './preload/bridges/MirrorsBridge'
import { statistics } from './preload/bridges/StatisticsBridge'
import { ShareBridge } from './preload/bridges/ShareBridge'
import { ExternalLinksBridge } from './preload/bridges/ExternalLinksBridge'
import { resourcePacks } from './preload/bridges/ResourcePacksBridge'
import { shaders } from './preload/bridges/ShadersBridge'
import { worlds } from './preload/bridges/WorldsBridge'
import { datapacks } from './preload/bridges/DatapacksBridge'
import { dialogs } from './preload/bridges/DialogsBridge'
import { operations } from './preload/bridges/OperationsBridge'
import { instances } from './preload/bridges/InstancesBridge'
import { archiveInspection } from './preload/bridges/ArchiveInspectionBridge'
import { providerCatalog } from './preload/bridges/ProviderCatalogBridge'
import { storageMaintenance } from './preload/bridges/StorageMaintenanceBridge'
import { javaRuntime } from './preload/bridges/JavaRuntimeBridge'
import { instanceMods } from './preload/bridges/InstanceModsBridge'
import { systemReadiness } from './preload/bridges/SystemReadinessBridge'
import type { FriendLauncherApi } from '@shared/contracts'

// The renderer receives one minimal, typed namespace. No raw IPC or legacy globals.
const api: FriendLauncherApi = {
  launcher,
  providerCatalog,
  storageMaintenance,
  javaRuntime,
  systemReadiness,
  mods,
  instanceMods,
  appUpdater,
  windowControls,
  network: networkAPI,
  cache,
  settings,
  assets,
  resourcePacks,
  shaders,
  screenshots,
  worlds,
  datapacks,
  dialogs,
  account: AccountBridge,
  mirrors: MirrorsBridge,
  statistics,
  share: ShareBridge,
  externalLinks: ExternalLinksBridge,
  operations,
  instances,
  archiveInspection,
}

contextBridge.exposeInMainWorld('api', api)
