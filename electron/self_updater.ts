import pkg from 'electron-updater';
const { autoUpdater } = pkg;
import { BrowserWindow, ipcMain } from "electron";

export class SelfUpdater {
    private win: BrowserWindow;

    constructor(win: BrowserWindow) {
        this.win = win;
        this.init();
    }

    private init() {
        // Keep downloads explicit to avoid unexpected bandwidth usage.
        autoUpdater.autoDownload = false;
        autoUpdater.autoInstallOnAppQuit = true;

        // App update events forwarded to the renderer.
        autoUpdater.on('checking-for-update', () => {
            this.send('app-updater:status', 'checking');
        });

        autoUpdater.on('update-available', (info) => {
            this.send('app-updater:available', info);
            autoUpdater.downloadUpdate();
        });

        autoUpdater.on('update-not-available', (info) => {
            this.send('app-updater:not-available', info);
        });

        autoUpdater.on('error', (err) => {
            this.send('app-updater:error', err.message);
        });

        autoUpdater.on('download-progress', (progressObj) => {
            this.send('app-updater:progress', progressObj);
        });

        autoUpdater.on('update-downloaded', (info) => {
            this.send('app-updater:downloaded', info);
        });

        // IPC handlers invoked by the renderer UI.
        ipcMain.handle('app-updater:check', async () => {
            return await autoUpdater.checkForUpdates();
        });

        ipcMain.handle('app-updater:quit-and-install', () => {
            autoUpdater.quitAndInstall();
        });
    }

    private send(channel: string, ...args: unknown[]) {
        if (!this.win.isDestroyed()) {
            this.win.webContents.send(channel, ...args);
        }
    }
}
