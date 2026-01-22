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
        autoUpdater.autoDownload = false; // Let user decide or auto download? Let's manual for now.
        autoUpdater.autoInstallOnAppQuit = true;

        // Logging
        // const log = require('electron-log'); // Optional: usually good for debugging
        // autoUpdater.logger = log;

        // Events
        autoUpdater.on('checking-for-update', () => {
            this.send('app-updater:status', 'checking');
        });

        autoUpdater.on('update-available', (info) => {
            this.send('app-updater:available', info);
            // Auto download for convenience?
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

        // IPC Handlers
        ipcMain.handle('app-updater:check', async () => {
            return await autoUpdater.checkForUpdates();
        });

        ipcMain.handle('app-updater:quit-and-install', () => {
            autoUpdater.quitAndInstall();
        });
    }

    private send(channel: string, ...args: any[]) {
        if (!this.win.isDestroyed()) {
            this.win.webContents.send(channel, ...args);
        }
    }
}
