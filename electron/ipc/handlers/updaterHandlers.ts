import { ipcMain, type BrowserWindow } from 'electron'
import type { ModpackService } from '../../services/modpacks/modpackService'
import { Updater } from '../../services/updater/instanceUpdater'
import type { InstanceUpdaterSyncOptions } from '@shared/contracts'
import { assertChildName } from '../../security/pathGuards'
import { assertPublicHttpsUrl } from '../../security/remoteUrls'
import { resolveApprovedInstancePath } from '../../services/instances/paths'

let inFlightSync: Promise<void> | null = null

export function registerUpdaterHandlers(deps: {
  window: BrowserWindow
  modpacks: ModpackService
}) {
  const { window, modpacks } = deps

  ipcMain.removeHandler('updater:sync')
  ipcMain.handle('updater:sync', async (_evt, manifestUrl: unknown, optionsOrRootPath?: InstanceUpdaterSyncOptions | string) => {
    const safeManifestUrl = assertPublicHttpsUrl(manifestUrl, 'Updater manifest URL')
    if (optionsOrRootPath !== undefined && typeof optionsOrRootPath !== 'string'
      && (typeof optionsOrRootPath !== 'object' || optionsOrRootPath === null || Array.isArray(optionsOrRootPath))) {
      throw new Error('Updater options must be an object or root path string')
    }
    const options: InstanceUpdaterSyncOptions =
      typeof optionsOrRootPath === 'string' ? { rootPath: optionsOrRootPath } : (optionsOrRootPath || {})

    const root = options.rootPath
      ? resolveApprovedInstancePath(options.rootPath)
      : modpacks.getDefaultRootPath()
    const selectedId = assertChildName(
      options.instanceId || modpacks.getSelectedModpackId(root) || 'default',
      'Modpack id',
    )
    const modpackPath = modpacks.getModpackDir(root, selectedId)

    const updater = new Updater(modpackPath)

    const run = async () => {
      await updater.sync(safeManifestUrl, (status, progress) => {
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
