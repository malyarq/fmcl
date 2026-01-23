import { ipcMain, BrowserWindow, app, dialog, shell } from 'electron';
import { LauncherManager } from '../launcher';
import { NetworkManager } from '../network';
import fs from 'fs';
import path from 'path';

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
    public static register(
        window: BrowserWindow,
        launcher: LauncherManager,
        network: NetworkManager
    ) {
        ipcMain.removeHandler('window:minimize');
        ipcMain.handle('window:minimize', () => {
            if (!window.isDestroyed()) window.minimize();
        });

        ipcMain.removeHandler('window:close');
        ipcMain.handle('window:close', () => {
            if (!window.isDestroyed()) window.close();
        });

        ipcMain.removeHandler('launcher:launch');
        ipcMain.handle('launcher:launch', async (_, options) => {
            try {
                const shouldHide = Boolean(options?.hideLauncher);
                await launcher.launchGame(
                    options,
                    (log) => {
                        if (!window.isDestroyed()) window.webContents.send('launcher:log', log);
                    },
                    (progress) => {
                        if (!window.isDestroyed()) window.webContents.send('launcher:progress', progress);
                    },
                    (code) => {
                        if (shouldHide && !window.isDestroyed()) {
                            window.show();
                            window.focus();
                        }
                        if (!window.isDestroyed()) window.webContents.send('launcher:close', code);
                    },
                    () => {
                        if (shouldHide && !window.isDestroyed()) {
                            window.hide();
                        }
                    }
                );
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                if (!window.isDestroyed()) {
                    window.webContents.send('launcher:log', `[FATAL] Launch failed: ${errorMessage}`);
                }
                throw error;
            }
        });

        ipcMain.removeHandler('launcher:getVersionList');
        ipcMain.handle('launcher:getVersionList', async (_, providerId) => {
            return await launcher.getVersionList(providerId);
        });

        ipcMain.removeHandler('launcher:getForgeSupportedVersions');
        ipcMain.handle('launcher:getForgeSupportedVersions', async (_, providerId) => {
            return await launcher.getForgeSupportedVersions(providerId);
        });

        ipcMain.removeHandler('launcher:getFabricSupportedVersions');
        ipcMain.handle('launcher:getFabricSupportedVersions', async () => {
            return await launcher.getFabricSupportedVersions();
        });

        ipcMain.removeHandler('launcher:getOptiFineSupportedVersions');
        ipcMain.handle('launcher:getOptiFineSupportedVersions', async () => {
            return await launcher.getOptiFineSupportedVersions();
        });

        ipcMain.removeHandler('launcher:getNeoForgeSupportedVersions');
        ipcMain.handle('launcher:getNeoForgeSupportedVersions', async (_, providerId) => {
            return await launcher.getNeoForgeSupportedVersions(providerId);
        });

        ipcMain.removeHandler('network:host');
        ipcMain.handle('network:host', async (_, port) => {
            return await network.host(port, (msg) => {
                if (!window.isDestroyed()) window.webContents.send('launcher:log', msg);
            });
        });

        ipcMain.removeHandler('network:join');
        ipcMain.handle('network:join', async (_, code) => {
            return await network.join(code, (msg) => {
                if (!window.isDestroyed()) window.webContents.send('launcher:log', msg);
            });
        });

        ipcMain.removeHandler('network:stop');
        ipcMain.handle('network:stop', async () => {
            return await network.stop((msg) => {
                if (!window.isDestroyed()) window.webContents.send('launcher:log', msg);
            });
        });

        ipcMain.removeHandler('launcher:clearCache');
        ipcMain.handle('launcher:clearCache', async () => {
            try {
                const userData = app.getPath('userData');
                const cacheFile = path.join(userData, 'download-cache.json');
                
                // Delete download cache file
                if (fs.existsSync(cacheFile)) {
                    fs.unlinkSync(cacheFile);
                }
                
                // Clear browser cache
                if (!window.isDestroyed()) {
                    await window.webContents.session.clearCache();
                    await window.webContents.session.clearStorageData();
                }
                
                return { success: true };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return { success: false, error: errorMessage };
            }
        });

        ipcMain.removeHandler('launcher:reload');
        ipcMain.handle('launcher:reload', async () => {
            if (!window.isDestroyed()) {
                window.reload();
            }
        });

        ipcMain.removeHandler('settings:selectMinecraftPath');
        ipcMain.handle('settings:selectMinecraftPath', async () => {
            try {
                const result = await dialog.showOpenDialog(window, {
                    properties: ['openDirectory'],
                    title: 'Select Minecraft Directory'
                });
                if (!result.canceled && result.filePaths.length > 0) {
                    return { success: true, path: result.filePaths[0] };
                }
                return { success: false, path: null };
            } catch (error: unknown) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return { success: false, error: errorMessage, path: null };
            }
        });

        ipcMain.removeHandler('settings:openMinecraftPath');
        ipcMain.handle('settings:openMinecraftPath', async (_, targetPath?: string) => {
            try {
                const pathToOpen = targetPath || path.join(app.getPath('userData'), 'minecraft_data');
                await shell.openPath(pathToOpen);
                return { success: true };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return { success: false, error: errorMessage };
            }
        });

        ipcMain.removeHandler('settings:getDefaultMinecraftPath');
        ipcMain.handle('settings:getDefaultMinecraftPath', async () => {
            return path.join(app.getPath('userData'), 'minecraft_data');
        });

        ipcMain.removeHandler('assets:getIconPath');
        ipcMain.handle('assets:getIconPath', async () => {
            // Get the path to the icon file
            // In dev: Vite dev server serves files from public
            // In prod: file should be in dist/icon.png inside asar
            // When using loadFile(path.join(RENDERER_DIST, 'index.html')),
            // relative paths like /icon.png should work relative to dist/
            const isDev = process.env['VITE_DEV_SERVER_URL'] !== undefined;
            
            if (isDev) {
                // Development: Vite dev server serves files from public
                return '/icon.png';
            } else {
                // Production: check multiple locations
                const appPath = app.getAppPath();
                const resourcesPath = path.dirname(appPath); // resources folder
                
                // 1. Check extraResources (most reliable - file is copied there)
                const extraResourcesPath = path.join(resourcesPath, 'icon.png');
                
                // 2. Check asar dist path
                const asarDistPath = path.join(appPath, 'dist', 'icon.png');
                
                // Try extraResources first (most reliable)
                try {
                    fs.readFileSync(extraResourcesPath);
                    const normalizedPath = extraResourcesPath.replace(/\\/g, '/');
                    if (normalizedPath.match(/^[A-Za-z]:/)) {
                        return `file:///${normalizedPath}`;
                    } else {
                        return `file://${normalizedPath}`;
                    }
                } catch {
                    // Try asar path
                    try {
                        fs.readFileSync(asarDistPath);
                        const normalizedPath = asarDistPath.replace(/\\/g, '/');
                        if (normalizedPath.match(/^[A-Za-z]:/)) {
                            return `file:///${normalizedPath}`;
                        } else {
                            return `file://${normalizedPath}`;
                        }
                    } catch {
                        // Fallback to relative path
                        console.warn(`[IPC] Icon file not found, using relative path`);
                        return '/icon.png';
                    }
                }
            }
        });

    }
}
