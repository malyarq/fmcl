import { ipcMain, type BrowserWindow } from 'electron'
import type { LauncherManager } from '../../services/launcher/orchestrator'
import type { LaunchGameOptions } from '../../services/launcher/orchestratorTypes'
import type { DownloadProviderId } from '../../services/mirrors/providers'
import type { TaskProgressData } from '@shared/types'
import type { LogSender } from '../logThrottler'

export function registerLauncherHandlers(deps: {
  window: BrowserWindow
  launcher: LauncherManager
  sendLog: LogSender
}) {
  const { window, launcher, sendLog } = deps

  ipcMain.removeHandler('launcher:launch')
  ipcMain.handle('launcher:launch', async (_evt, options: LaunchGameOptions) => {
    try {
      const shouldHide = Boolean(options?.hideLauncher)
      await launcher.launchGame(
        options,
        (log: string) => {
          sendLog(log)
        },
        (progress: TaskProgressData) => {
          if (!window.isDestroyed()) window.webContents.send('launcher:progress', progress)
        },
        (code: number) => {
          if (shouldHide && !window.isDestroyed()) {
            window.show()
            window.focus()
          }
          if (!window.isDestroyed()) window.webContents.send('launcher:close', code)
        },
        () => {
          if (shouldHide && !window.isDestroyed()) {
            window.hide()
          }
        }
      )
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      sendLog(`[FATAL] Launch failed: ${errorMessage}`)
      throw error
    }
  })

  ipcMain.removeHandler('launcher:getVersionList')
  ipcMain.handle('launcher:getVersionList', async (_evt, providerId?: DownloadProviderId) => {
    return await launcher.getVersionList(providerId)
  })

  ipcMain.removeHandler('launcher:getForgeSupportedVersions')
  ipcMain.handle('launcher:getForgeSupportedVersions', async (_evt, providerId?: DownloadProviderId) => {
    return await launcher.getForgeSupportedVersions(providerId)
  })

  ipcMain.removeHandler('launcher:getFabricSupportedVersions')
  ipcMain.handle('launcher:getFabricSupportedVersions', async () => {
    return await launcher.getFabricSupportedVersions()
  })

  ipcMain.removeHandler('launcher:getOptiFineSupportedVersions')
  ipcMain.handle('launcher:getOptiFineSupportedVersions', async () => {
    return await launcher.getOptiFineSupportedVersions()
  })

  ipcMain.removeHandler('launcher:getNeoForgeSupportedVersions')
  ipcMain.handle('launcher:getNeoForgeSupportedVersions', async (_evt, providerId?: DownloadProviderId) => {
    return await launcher.getNeoForgeSupportedVersions(providerId)
  })
}

