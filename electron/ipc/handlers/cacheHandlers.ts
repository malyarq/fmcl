import { ipcMain, type BrowserWindow, app } from 'electron'
import fs from 'fs'
import path from 'path'
import { ImageCacheService } from '../../services/cache/imageCacheService'
import { assertPublicHttpsUrl } from '../../security/remoteUrls'

export function registerCacheHandlers(deps: { window: BrowserWindow }) {
  const { window } = deps
  const imageCacheService = new ImageCacheService(app.getPath('userData'))

  ipcMain.removeHandler('launcher:clearCache')
  ipcMain.handle('launcher:clearCache', async () => {
    try {
      const userData = app.getPath('userData')
      const cacheFile = path.join(userData, 'download-cache.json')

      // Delete download cache file
      if (fs.existsSync(cacheFile)) {
        fs.unlinkSync(cacheFile)
      }

      await imageCacheService.clear()

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

  ipcMain.removeHandler('cache:getImageState')
  ipcMain.handle('cache:getImageState', async () => {
    return imageCacheService.getState()
  })

  ipcMain.removeHandler('cache:setImageLimit')
  ipcMain.handle('cache:setImageLimit', async (_event, maxSizeBytes: unknown) => {
    if (typeof maxSizeBytes !== 'number' || !Number.isFinite(maxSizeBytes)) {
      throw new Error('Image cache limit must be a finite number')
    }

    return imageCacheService.setMaxSizeBytes(maxSizeBytes)
  })

  ipcMain.removeHandler('cache:cleanupImage')
  ipcMain.handle('cache:cleanupImage', async () => {
    return imageCacheService.cleanupToLimit()
  })

  ipcMain.removeHandler('cache:resolveImage')
  ipcMain.handle('cache:resolveImage', async (_event, sourceUrl: unknown) => {
    return imageCacheService.resolveImage(assertPublicHttpsUrl(sourceUrl, 'Image URL'))
  })
}
