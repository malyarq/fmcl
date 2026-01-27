import { ipcMain, app } from 'electron'
import fs from 'fs'
import path from 'path'

export function registerAssetsHandlers() {
  ipcMain.removeHandler('assets:getIconPath')
  ipcMain.handle('assets:getIconPath', async () => {
    // Get the path to the icon file
    // In dev: Vite dev server serves files from public
    // In prod: file should be in dist/icon.png inside asar
    // When using loadFile(path.join(RENDERER_DIST, 'index.html')),
    // relative paths like /icon.png should work relative to dist/
    const isDev = process.env['VITE_DEV_SERVER_URL'] !== undefined

    if (isDev) {
      // Development: Vite dev server serves files from public
      return '/icon.png'
    } else {
      // Production: check multiple locations
      const appPath = app.getAppPath()
      const resourcesPath = path.dirname(appPath) // resources folder

      // 1. Check extraResources (most reliable - file is copied there)
      const extraResourcesPath = path.join(resourcesPath, 'icon.png')

      // 2. Check asar dist path
      const asarDistPath = path.join(appPath, 'dist', 'icon.png')

      // Try extraResources first (most reliable)
      try {
        fs.readFileSync(extraResourcesPath)
        const normalizedPath = extraResourcesPath.replace(/\\/g, '/')
        if (normalizedPath.match(/^[A-Za-z]:/)) {
          return `file:///${normalizedPath}`
        } else {
          return `file://${normalizedPath}`
        }
      } catch {
        // Try asar path
        try {
          fs.readFileSync(asarDistPath)
          const normalizedPath = asarDistPath.replace(/\\/g, '/')
          if (normalizedPath.match(/^[A-Za-z]:/)) {
            return `file:///${normalizedPath}`
          } else {
            return `file://${normalizedPath}`
          }
        } catch {
          // Fallback to relative path
          console.warn(`[IPC] Icon file not found, using relative path`)
          return '/icon.png'
        }
      }
    }
  })
}

