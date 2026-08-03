import type { BrowserWindow } from 'electron'
import type { LauncherManager } from '../services/launcher/orchestrator'
import type { ModPlatformService } from '../services/mods/platform/modPlatformService'
import type { ModpackService } from '../services/modpacks/modpackService'
import type { NetworkService } from '../services/network/networkService'
import { registerAssetsHandlers } from './handlers/assetsHandlers'
import { registerAppUpdaterHandlers } from './handlers/appUpdaterHandlers'
import { registerCacheHandlers } from './handlers/cacheHandlers'
import { registerModpacksHandlers } from './handlers/modpacksHandlers'
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
import { AccountService } from '../services/account/accountService'
import { registerAccountHandlers } from './handlers/accountHandlers'
import { registerMirrorsHandlers } from './handlers/mirrorsHandlers'
import { MirrorsService } from '../services/mirrors/mirrorsService'
import { registerStatisticsHandlers } from './handlers/statisticsHandlers'
import { registerExternalLinksHandlers } from './handlers/externalLinksHandlers'
import { StatisticsService } from '../services/stats/statisticsService'
import type { OperationRunner } from '../services/operations/operationRunner'
import { registerOperationsHandlers } from './handlers/operationsHandlers'

import { registerShareHandlers } from './handlers/shareHandlers'
import { ShareService } from '../services/sharing/shareService'

/**
 * Centralized Manager for Electron Inter-Process Communication (IPC).
 * Registers handlers for window controls, launcher operations, and networking.
 */
export class IPCManager {
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
    public static registerAllHandlers(params: {
        window: BrowserWindow,
        launcher: LauncherManager,
        modPlatforms: ModPlatformService,
        networkService: NetworkService,
        modpacks: ModpackService,
        accountService: AccountService,
        mirrorsService: MirrorsService,
        statisticsService: StatisticsService,
        shareService: ShareService,
        operations: OperationRunner,
    }) {
        const { window, launcher, networkService, modPlatforms, modpacks, accountService, mirrorsService, statisticsService, shareService, operations } = params
        const sendLog = createThrottledLauncherLogSender()

        registerWindowHandlers({ window })
        registerLauncherHandlers({ window, launcher, sendLog })
        registerCacheHandlers({ window })
        registerModsHandlers({ modPlatforms })
        registerModpacksHandlers({ modpacks, modPlatforms })
        registerNetworkHandlers({ window, networkService, sendLog })
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
        registerOperationsHandlers({ runner: operations })
    }
}
