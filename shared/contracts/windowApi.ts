import type { AppUpdaterAPI } from './appUpdater'
import type { AssetsAPI } from './assets'
import type { CacheAPI } from './cache'
import type { ProviderCatalogAPI } from './providerCatalog'
import type { StorageMaintenanceAPI } from './storageMaintenance'
import type { JavaRuntimeAPI } from './javaRuntime'
import type { LauncherAPI } from './launcher'
import type { ModsAPI } from './mods'
import type { InstanceModsAPI } from './instanceMods'
import type { NetworkAPI } from './network'
import type { SettingsAPI } from './settings'
import type { WindowControlsAPI } from './windowControls'
import type { AccountAPI } from './account'
import type { MirrorsAPI } from './mirrors'
import type { StatisticsAPI } from './statistics'
import type { ShareAPI } from './share'
import type { ExternalLinksAPI } from './externalLinks'
import type { ResourcePacksAPI } from './resourcePacks'
import type { ShadersAPI } from './shaders'
import type { ScreenshotsAPI } from './screenshots'
import type { WorldsAPI } from './worlds'
import type { DatapacksAPI } from './datapacks'
import type { DialogsAPI } from './dialogs'
import type { OperationsAPI } from './operations'
import type { InstancesAPI } from './instances'
import type { ArchiveInspectionAPI } from './archiveInspection'
import type { SystemReadinessAPI } from './systemReadiness'

/**
 * Supported, namespaced preload surface for renderer code.
 *
 * This is the renderer's only supported main-process boundary.
 */
export type BurrowApi = {
  launcher: LauncherAPI
  providerCatalog: ProviderCatalogAPI
  storageMaintenance: StorageMaintenanceAPI
  javaRuntime: JavaRuntimeAPI
  systemReadiness: SystemReadinessAPI
  mods: ModsAPI
  instanceMods: InstanceModsAPI
  windowControls: WindowControlsAPI
  network: NetworkAPI
  cache: CacheAPI
  settings: SettingsAPI
  assets: AssetsAPI
  resourcePacks: ResourcePacksAPI
  shaders: ShadersAPI
  screenshots: ScreenshotsAPI
  worlds: WorldsAPI
  datapacks: DatapacksAPI
  dialogs: DialogsAPI
  appUpdater: AppUpdaterAPI
  account: AccountAPI
  mirrors: MirrorsAPI
  statistics: StatisticsAPI
  share: ShareAPI
  externalLinks: ExternalLinksAPI
  operations: OperationsAPI
  instances: InstancesAPI
  archiveInspection: ArchiveInspectionAPI
}
