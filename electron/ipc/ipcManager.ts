import { ipcMain, type BrowserWindow } from 'electron'
import { registerAssetsHandlers } from './handlers/assetsHandlers'
import { registerAppUpdaterHandlers } from './handlers/appUpdaterHandlers'
import { registerCacheHandlers } from './handlers/cacheHandlers'
import { registerLauncherHandlers } from './handlers/launcherHandlers'
import { registerModsHandlers } from './handlers/modsHandlers'
import { registerNetworkHandlers } from './handlers/networkHandlers'
import { registerSettingsHandlers } from './handlers/settingsHandlers'
import { registerWindowHandlers } from './handlers/windowHandlers'
import { registerResourcePacksHandlers } from './handlers/resourcePacksHandlers'
import { registerShadersHandlers } from './handlers/shadersHandlers'
import { registerWorldsHandlers } from './handlers/worldsHandlers'
import { registerDatapacksHandlers } from './handlers/datapacksHandlers'
import { registerScreenshotsHandlers } from './handlers/screenshotsHandlers'
import { registerAppHandlers } from './handlers/appHandlers'
import { createThrottledLauncherLogSender } from './logThrottler'
import { registerAccountHandlers } from './handlers/accountHandlers'
import { registerMirrorsHandlers } from './handlers/mirrorsHandlers'
import { registerStatisticsHandlers } from './handlers/statisticsHandlers'
import { registerExternalLinksHandlers } from './handlers/externalLinksHandlers'
import { registerOperationsHandlers } from './handlers/operationsHandlers'
import { createInstancesHandlers } from './handlers/instancesHandlers'
import { registerArchiveInspectionHandlers } from './handlers/archiveInspectionHandlers'
import { registerProviderCatalogHandlers } from './handlers/providerCatalogHandlers'
import { registerStorageMaintenanceHandlers } from './handlers/storageMaintenanceHandlers'
import { registerJavaRuntimeHandlers } from './handlers/javaRuntimeHandlers'
import { registerSystemReadinessHandlers } from './handlers/systemReadinessHandlers'
import { checkSystemReadiness } from '../services/readiness/systemReadiness'
import { registerInstanceModsHandlers } from './handlers/instanceModsHandlers'
import { INSTANCE_CHANNELS } from '../../shared/contracts/instances'
import { allowedIpcChannels } from '../../shared/contracts/ipcChannels'

import { registerShareHandlers } from './handlers/shareHandlers'
import type { HandlerComposition } from '../app/compositionRoot'

/**
 * Centralized Manager for Electron Inter-Process Communication (IPC).
 * Registers handlers for window controls, launcher operations, and networking.
 */
export class IPCManager {
    public static unregisterAllHandlers(): void {
        for (const channel of allowedIpcChannels) ipcMain.removeHandler(channel)
    }
    /**
     * Registers all IPC handlers with the Main process.
     * 
     * @param window The main BrowserWindow instance (used for sending events back).
     * @param launcher The LauncherManager instance.
     * @param network The NetworkManager instance.
     */
    /**
     * Thin wiring layer: registers domain handlers.
     * Dependencies are created in bootstrap and passed in.
     */
    public static registerAllHandlers(params: { window: BrowserWindow; composition: HandlerComposition }) {
        const { window, composition } = params
        const { application, getDefaultRootPath, getDefaultInstanceRoot, scanJava, inspectArchive, launcher, burrowLink, lanDiscovery, portMapping, modPlatforms, instanceMods, storageMaintenance, accountService, mirrorsService, statisticsService, shareService, operations, consumeArchiveReference } = composition
        const sendLog = createThrottledLauncherLogSender()

        registerWindowHandlers({ window })
        registerLauncherHandlers({ window, launcher, sendLog })
        registerCacheHandlers({ window })
        registerModsHandlers({ modPlatforms, getDefaultRootPath })
        registerProviderCatalogHandlers({ providerCatalog: modPlatforms })
        registerStorageMaintenanceHandlers({ storageMaintenance })
        registerJavaRuntimeHandlers({
            application,
            getDefaultInstanceRoot,
            scanJava,
        })
        registerSystemReadinessHandlers(async () => await checkSystemReadiness({
            rootPath: getDefaultRootPath(),
            scanJava,
        }))
        registerInstanceModsHandlers({ instanceMods })
        registerNetworkHandlers({ window, burrowLink, lanDiscovery, portMapping })
        registerSettingsHandlers({ window })
        registerAssetsHandlers()
        registerAppUpdaterHandlers()
        registerResourcePacksHandlers()
        registerShadersHandlers()
        registerWorldsHandlers()
        registerDatapacksHandlers({ modPlatforms })
        registerScreenshotsHandlers()
        registerAppHandlers()
        registerAccountHandlers({ accountService })
        registerMirrorsHandlers({ mirrorsService })
        registerStatisticsHandlers({ statisticsService })
        registerShareHandlers({ shareService })
        registerExternalLinksHandlers()
        registerOperationsHandlers({ runner: operations, consumeArchiveReference })
        registerArchiveInspectionHandlers({ window, inspectArchive })

        const instancesHandlers = createInstancesHandlers({ application, getDefaultInstanceRoot })
        for (const channel of Object.values(INSTANCE_CHANNELS)) {
            ipcMain.removeHandler(channel)
            ipcMain.handle(channel, async (_event, request: unknown) => await instancesHandlers[channel](request))
        }
    }
}
