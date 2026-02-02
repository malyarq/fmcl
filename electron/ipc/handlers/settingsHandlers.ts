import { ipcMain, type BrowserWindow, app, dialog, shell } from 'electron'
import path from 'path'

export function registerSettingsHandlers(deps: { window: BrowserWindow }) {
  const { window } = deps

  ipcMain.removeHandler('settings:selectMinecraftPath')
  ipcMain.handle('settings:selectMinecraftPath', async () => {
    try {
      const result = await dialog.showOpenDialog(window, {
        properties: ['openDirectory'],
        title: 'Select Minecraft Directory',
      })
      if (!result.canceled && result.filePaths.length > 0) {
        return { success: true, path: result.filePaths[0] }
      }
      return { success: false, path: null }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return { success: false, error: errorMessage, path: null }
    }
  })

  ipcMain.removeHandler('settings:openMinecraftPath')
  ipcMain.handle('settings:openMinecraftPath', async (_evt, targetPath?: string) => {
    try {
      const pathToOpen = targetPath || path.join(app.getPath('userData'), 'minecraft_data')
      await shell.openPath(pathToOpen)
      return { success: true }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return { success: false, error: errorMessage }
    }
  })

  ipcMain.removeHandler('settings:getDefaultMinecraftPath')
  ipcMain.handle('settings:getDefaultMinecraftPath', async () => {
    return path.join(app.getPath('userData'), 'minecraft_data')
  })

  ipcMain.removeHandler('dialog:showSaveDialog')
  ipcMain.handle('dialog:showSaveDialog', async (_evt, options: Electron.SaveDialogOptions) => {
    try {
      const result = await dialog.showSaveDialog(window, options)
      return result
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return { canceled: true, filePath: undefined, error: errorMessage }
    }
  })

  ipcMain.removeHandler('dialog:showOpenDialog')
  ipcMain.handle('dialog:showOpenDialog', async (_evt, options: Electron.OpenDialogOptions) => {
    try {
      const result = await dialog.showOpenDialog(window, options)
      return result
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return { canceled: true, filePaths: [], error: errorMessage }
    }
  })

  ipcMain.removeHandler('dialog:getDesktopPath')
  ipcMain.handle('dialog:getDesktopPath', async () => {
    try {
      return app.getPath('desktop')
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      throw new Error(`Failed to get desktop path: ${errorMessage}`)
    }
  })
}

