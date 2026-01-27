import { ipcMain, type BrowserWindow } from 'electron'
import type { ModpackService } from '../../services/modpacks/modpackService'
import { Updater } from '../../services/updater/instanceUpdater'
import type { InstanceUpdaterSyncOptions } from '@shared/contracts'

let inFlightSync: Promise<void> | null = null

export function registerUpdaterHandlers(deps: {
  window: BrowserWindow
  modpacks: ModpackService
}) {
  const { window, modpacks } = deps

  ipcMain.removeHandler('updater:sync')
  ipcMain.handle('updater:sync', async (_evt, manifestUrl: string, optionsOrRootPath?: InstanceUpdaterSyncOptions | string) => {
    const options: InstanceUpdaterSyncOptions =
      typeof optionsOrRootPath === 'string' ? { rootPath: optionsOrRootPath } : (optionsOrRootPath || {})

    const root = options.rootPath || modpacks.getDefaultRootPath()
    const selectedId = options.instanceId || modpacks.getSelectedModpackId(root) || 'default'
    const modpackPath = modpacks.getModpackDir(root, selectedId)

    const updater = new Updater(modpackPath)

    const run = async () => {
      await updater.sync(manifestUrl, (status, progress) => {
        if (!window.isDestroyed()) window.webContents.send('updater:progress', { status, progress })
      })
    }

    // Avoid overlapping sync runs (best-effort).
    if (!inFlightSync) {
      inFlightSync = run().finally(() => {
        inFlightSync = null
      })
    } else {
      // Wait for current sync, then run a new one.
      inFlightSync = inFlightSync.then(run).finally(() => {
        inFlightSync = null
      })
    }

    await inFlightSync
  })
}

