import pkg from 'electron-updater'
const { autoUpdater } = pkg
import { ipcMain } from 'electron'

export function registerAppUpdaterHandlers() {
  ipcMain.removeHandler('app-updater:check')
  ipcMain.handle('app-updater:check', async () => {
    return await autoUpdater.checkForUpdates()
  })

  ipcMain.removeHandler('app-updater:quit-and-install')
  ipcMain.handle('app-updater:quit-and-install', () => {
    autoUpdater.quitAndInstall()
  })
}

