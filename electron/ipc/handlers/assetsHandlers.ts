import { ipcMain, app } from 'electron'
import fs from 'fs'
import path from 'path'

export function registerAssetsHandlers() {
  ipcMain.removeHandler('assets:getIconPath')
  ipcMain.handle('assets:getIconPath', async () => {
    const iconFileName = 'icon.ico'
    const fallbackIconFileName = 'icon.png'

    // Get the path to the icon file
    // In dev: Vite dev server serves files from public
    // In prod: file should be in dist/icon.ico inside asar
    // When using loadFile(path.join(RENDERER_DIST, 'index.html')),
    // relative paths like /icon.ico should work relative to dist/
    const isDev = process.env['VITE_DEV_SERVER_URL'] !== undefined

    if (isDev) {
      // Development: Vite dev server serves files from public
      return `/${iconFileName}`
    } else {
      // Production: check multiple locations
      const appPath = app.getAppPath()
      const resourcesPath = path.dirname(appPath) // resources folder

      // 1. Check extraResources (most reliable - file is copied there)
      const extraResourcesPath = path.join(resourcesPath, iconFileName)
      const extraResourcesFallbackPath = path.join(resourcesPath, fallbackIconFileName)

      // 2. Check asar dist path
      const asarDistPath = path.join(appPath, 'dist', iconFileName)
      const asarDistFallbackPath = path.join(appPath, 'dist', fallbackIconFileName)

      const toFileUrl = (filePath: string) => {
        const normalizedPath = filePath.replace(/\\/g, '/')
        if (normalizedPath.match(/^[A-Za-z]:/)) {
          return `file:///${normalizedPath}`
        }
        return `file://${normalizedPath}`
      }

      // Try extraResources first (most reliable)
      try {
        fs.readFileSync(extraResourcesPath)
        return toFileUrl(extraResourcesPath)
      } catch {
        try {
          fs.readFileSync(extraResourcesFallbackPath)
          return toFileUrl(extraResourcesFallbackPath)
        } catch {
          // Try asar path
          try {
            fs.readFileSync(asarDistPath)
            return toFileUrl(asarDistPath)
          } catch {
            try {
              fs.readFileSync(asarDistFallbackPath)
              return toFileUrl(asarDistFallbackPath)
            } catch {
              // Fallback to relative path
              console.warn(`[IPC] Icon file not found, using relative path`)
              return `/${iconFileName}`
            }
          }
        }
      }
    }
  })
}
