import { ipcMain, type BrowserWindow, app } from 'electron'
import fs from 'fs'
import path from 'path'

export function registerCacheHandlers(deps: { window: BrowserWindow }) {
  const { window } = deps

  ipcMain.removeHandler('launcher:clearCache')
  ipcMain.handle('launcher:clearCache', async () => {
    try {
      const userData = app.getPath('userData')
      const cacheFile = path.join(userData, 'download-cache.json')

      // Delete download cache file
      if (fs.existsSync(cacheFile)) {
        fs.unlinkSync(cacheFile)
      }

      // Clear browser cache
      if (!window.isDestroyed()) {
        await window.webContents.session.clearCache()
        await window.webContents.session.clearStorageData()
      }

      return { success: true }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return { success: false, error: errorMessage }
    }
  })

  ipcMain.removeHandler('launcher:reload')
  ipcMain.handle('launcher:reload', async () => {
    if (!window.isDestroyed()) {
      window.reload()
    }
  })
}

