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
import { registerUpdaterHandlers } from './handlers/updaterHandlers'
import { registerWindowHandlers } from './handlers/windowHandlers'
import { createThrottledLauncherLogSender } from './logThrottler'

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
    }) {
        const { window, launcher, networkService, modPlatforms, modpacks } = params
        const sendLog = createThrottledLauncherLogSender(window)

        registerWindowHandlers({ window })
        registerLauncherHandlers({ window, launcher, sendLog })
        registerCacheHandlers({ window })
        registerModsHandlers({ modPlatforms })
        registerModpacksHandlers({ modpacks, modPlatforms, window })
        registerNetworkHandlers({ window, networkService, sendLog })
        registerSettingsHandlers({ window })
        registerAssetsHandlers()
        registerUpdaterHandlers({ window, modpacks })
        registerAppUpdaterHandlers()
    }
}
