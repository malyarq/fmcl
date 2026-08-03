import { ipcMain, type BrowserWindow } from 'electron'
import type { LauncherManager } from '../../services/launcher/orchestrator'
import type { DownloadProviderId } from '../../services/mirrors/providers'
import type { TaskProgressData } from '@shared/types'
import type { LogSender } from '../logThrottler'
import {
  validateLaunchGameOptions,
  validateOptionalDownloadProvider,
} from '../validation/launcherPayloads'
import { validateBoundedString } from '../validation/privilegedPayloads'

export function registerLauncherHandlers(deps: {
  window: BrowserWindow
  launcher: LauncherManager
  sendLog: LogSender
}) {
  const { window, launcher, sendLog } = deps

  ipcMain.removeHandler('launcher:killAndRestart')
  ipcMain.handle('launcher:killAndRestart', async () => {
    await launcher.killGameProcess()
    if (!window.isDestroyed()) window.reload()
  })

  ipcMain.removeHandler('launcher:launch')
  ipcMain.handle('launcher:launch', async (_evt, rawOptions: unknown) => {
    try {
      const options = validateLaunchGameOptions(rawOptions)
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
    return await launcher.getVersionList(validateOptionalDownloadProvider(providerId))
  })

  ipcMain.removeHandler('launcher:getForgeSupportedVersions')
  ipcMain.handle('launcher:getForgeSupportedVersions', async (_evt, providerId?: DownloadProviderId) => {
    return await launcher.getForgeSupportedVersions(validateOptionalDownloadProvider(providerId))
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
    return await launcher.getNeoForgeSupportedVersions(validateOptionalDownloadProvider(providerId))
  })

  ipcMain.removeHandler('launcher:stdin')
  ipcMain.handle('launcher:stdin', (_evt, data: unknown) => {
    launcher.writeToGameStdin(validateBoundedString(data, 'Game console input', {
      maxLength: 4_096,
      allowControlChars: true,
      trim: false,
    }))
  })
}
