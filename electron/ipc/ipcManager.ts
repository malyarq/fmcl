import { ipcMain, BrowserWindow } from 'electron';
import { LauncherManager } from '../launcher';
import { NetworkManager } from '../network';

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
        // --- Window Controls ---
        ipcMain.removeHandler('window:minimize');
        ipcMain.handle('window:minimize', () => {
            // Check if window is destroyed to prevent errors
            if (!window.isDestroyed()) window.minimize();
        });

        ipcMain.removeHandler('window:close');
        ipcMain.handle('window:close', () => {
            if (!window.isDestroyed()) window.close();
        });

        // --- Launcher Operations ---
        ipcMain.removeHandler('launcher:launch');
        ipcMain.handle('launcher:launch', async (_, options) => {
            try {
                // Delegate launch logic to LauncherManager
                // We pass callbacks that send IPC messages back to the renderer
                await launcher.launchGame(
                    options,
                    (log) => {
                        if (!window.isDestroyed()) window.webContents.send('launcher:log', log);
                    },
                    (progress) => {
                        if (!window.isDestroyed()) window.webContents.send('launcher:progress', progress);
                    },
                    (code) => {
                        if (!window.isDestroyed()) window.webContents.send('launcher:close', code);
                    }
                );
            } catch (error: any) {
                if (!window.isDestroyed()) {
                    window.webContents.send('launcher:log', `[FATAL] Launch failed: ${error.message}`);
                }
                throw error;
            }
        });

        // --- Network (P2P) Operations ---
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

        // --- Updater (Placeholder) ---
        // ipcMain.handle('updater:sync', ...)
    }
}
