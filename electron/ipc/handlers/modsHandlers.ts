import { ipcMain } from 'electron'
import type { ModPlatformService } from '../../services/mods/platform/modPlatformService'

export function registerModsHandlers(deps: { modPlatforms: ModPlatformService }) {
  const { modPlatforms } = deps

  ipcMain.removeHandler('mods:searchMods')
  ipcMain.handle('mods:searchMods', async (_evt, query) => {
    return await modPlatforms.searchMods(query)
  })

  ipcMain.removeHandler('mods:getModVersions')
  ipcMain.handle('mods:getModVersions', async (_evt, query) => {
    return await modPlatforms.getModVersions(query)
  })

  ipcMain.removeHandler('mods:installModFile')
  ipcMain.handle('mods:installModFile', async (_evt, req) => {
    return await modPlatforms.installModFile(req)
  })
}

