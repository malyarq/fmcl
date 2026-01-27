import { ipcMain, type BrowserWindow } from 'electron'

export function registerWindowHandlers(deps: { window: BrowserWindow }) {
  const { window } = deps

  ipcMain.removeHandler('window:minimize')
  ipcMain.handle('window:minimize', () => {
    if (!window.isDestroyed()) window.minimize()
  })

  ipcMain.removeHandler('window:close')
  ipcMain.handle('window:close', () => {
    if (!window.isDestroyed()) window.close()
  })
}

