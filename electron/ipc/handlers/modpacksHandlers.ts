import { ipcMain, type BrowserWindow } from 'electron'
import type { ModpackConfig, ModpackService } from '../../services/modpacks/modpackService'
import type { ModPlatformService } from '../../services/mods/platform/modPlatformService'
import { downloadCurseForgeModpack } from '../../services/modpacks/installers/curseforgeInstaller'
import { downloadModrinthModpack } from '../../services/modpacks/installers/modrinthInstaller'

export function registerModpacksHandlers(deps: { 
  modpacks: ModpackService
  modPlatforms: ModPlatformService
  window?: BrowserWindow
}) {
  const { modpacks, modPlatforms, window } = deps

  ipcMain.removeHandler('modpacks:list')
  ipcMain.handle('modpacks:list', async (_evt, rootPath?: string) => {
    const root = rootPath || modpacks.getDefaultRootPath()
    return modpacks.listModpacks(root)
  })

  ipcMain.removeHandler('modpacks:listWithMetadata')
  ipcMain.handle('modpacks:listWithMetadata', async (_evt, rootPath?: string) => {
    const root = rootPath || modpacks.getDefaultRootPath()
    return modpacks.listModpacksWithMetadata(root)
  })

  ipcMain.removeHandler('modpacks:bootstrap')
  ipcMain.handle('modpacks:bootstrap', async (_evt, seed?: unknown, rootPath?: string) => {
    const root = rootPath || modpacks.getDefaultRootPath()
    // Seed is trusted from renderer only for first-run migration;
    // ModpackService will ignore it if modpacks.json already exists.
    return modpacks.bootstrapModpacks(root, seed as Partial<ModpackConfig> | undefined)
  })

  ipcMain.removeHandler('modpacks:getSelected')
  ipcMain.handle('modpacks:getSelected', async (_evt, rootPath?: string) => {
    const root = rootPath || modpacks.getDefaultRootPath()
    return modpacks.getSelectedModpackId(root)
  })

  ipcMain.removeHandler('modpacks:setSelected')
  ipcMain.handle('modpacks:setSelected', async (_evt, modpackId: string, rootPath?: string) => {
    const root = rootPath || modpacks.getDefaultRootPath()
    modpacks.setSelectedModpack(root, modpackId)
    return { ok: true }
  })

  ipcMain.removeHandler('modpacks:create')
  ipcMain.handle('modpacks:create', async (_evt, name: string, rootPath?: string) => {
    const root = rootPath || modpacks.getDefaultRootPath()
    return modpacks.createModpack(root, name)
  })

  ipcMain.removeHandler('modpacks:rename')
  ipcMain.handle('modpacks:rename', async (_evt, modpackId: string, name: string, rootPath?: string) => {
    const root = rootPath || modpacks.getDefaultRootPath()
    return modpacks.renameModpack(root, modpackId, name)
  })

  ipcMain.removeHandler('modpacks:duplicate')
  ipcMain.handle('modpacks:duplicate', async (_evt, sourceId: string, name?: string, rootPath?: string) => {
    const root = rootPath || modpacks.getDefaultRootPath()
    return modpacks.duplicateModpack(root, sourceId, name)
  })

  ipcMain.removeHandler('modpacks:delete')
  ipcMain.handle('modpacks:delete', async (_evt, modpackId: string, rootPath?: string) => {
    const root = rootPath || modpacks.getDefaultRootPath()
    modpacks.deleteModpack(root, modpackId)
    return { ok: true }
  })

  ipcMain.removeHandler('modpacks:getConfig')
  ipcMain.handle('modpacks:getConfig', async (_evt, modpackId: string, rootPath?: string) => {
    const root = rootPath || modpacks.getDefaultRootPath()
    return modpacks.loadModpackConfig(root, modpackId)
  })

  ipcMain.removeHandler('modpacks:saveConfig')
  ipcMain.handle('modpacks:saveConfig', async (_evt, cfg, rootPath?: string) => {
    const root = rootPath || modpacks.getDefaultRootPath()
    modpacks.saveModpackConfig(root, cfg)
    return { ok: true }
  })

  ipcMain.removeHandler('modpacks:getMetadata')
  ipcMain.handle('modpacks:getMetadata', async (_evt, modpackId: string, rootPath?: string) => {
    const root = rootPath || modpacks.getDefaultRootPath()
    return modpacks.getModpackMetadata(root, modpackId)
  })

  ipcMain.removeHandler('modpacks:updateMetadata')
  ipcMain.handle('modpacks:updateMetadata', async (_evt, modpackId: string, updates: unknown, rootPath?: string) => {
    const root = rootPath || modpacks.getDefaultRootPath()
    return modpacks.updateModpackMetadata(root, modpackId, updates as Partial<import('../../../shared/types/modpack').ModpackMetadata>)
  })

  // Поиск модпаков
  ipcMain.removeHandler('modpacks:searchCurseForge')
  ipcMain.handle('modpacks:searchCurseForge', async (
    _evt,
    query: string,
    mcVersion?: string,
    loader?: string,
    sort?: 'popularity' | 'date' | 'alphabetical',
    offset?: number,
    limit?: number,
  ) => {
    return modPlatforms.searchCurseForgeModpacks(query, mcVersion, loader, sort, offset, limit)
  })

  ipcMain.removeHandler('modpacks:searchModrinth')
  ipcMain.handle('modpacks:searchModrinth', async (
    _evt,
    query: string,
    mcVersion?: string,
    loader?: string,
    sort?: 'popularity' | 'date' | 'alphabetical',
    offset?: number,
    limit?: number,
  ) => {
    return modPlatforms.searchModrinthModpacks(query, mcVersion, loader, sort, offset, limit)
  })

  ipcMain.removeHandler('modpacks:getCurseForgeVersions')
  ipcMain.handle('modpacks:getCurseForgeVersions', async (_evt, projectId: number) => {
    return modPlatforms.getCurseForgeModpackVersions(projectId)
  })

  ipcMain.removeHandler('modpacks:getModrinthVersions')
  ipcMain.handle('modpacks:getModrinthVersions', async (_evt, projectId: string) => {
    return modPlatforms.getModrinthModpackVersions(projectId)
  })

  // Установка модпаков
  ipcMain.removeHandler('modpacks:installCurseForge')
  ipcMain.handle('modpacks:installCurseForge', async (
    _evt,
    projectId: number,
    fileId: number,
    targetModpackId?: string,
    rootPath?: string,
  ) => {
    const root = rootPath || modpacks.getDefaultRootPath()
    const curseforge = modPlatforms.getCurseForgeClient()
    if (!curseforge) {
      throw new Error('CurseForge API key is not configured')
    }
    return downloadCurseForgeModpack(curseforge, modpacks, {
      projectId,
      fileId,
      targetModpackId,
      rootPath: root,
      onProgress: (progress) => {
        if (window && !window.isDestroyed()) {
          window.webContents.send('modpacks:updateProgress', progress)
        }
      },
    })
  })

  ipcMain.removeHandler('modpacks:installModrinth')
  ipcMain.handle('modpacks:installModrinth', async (
    _evt,
    projectId: string,
    versionId: string,
    targetModpackId?: string,
    rootPath?: string,
  ) => {
    const root = rootPath || modpacks.getDefaultRootPath()
    const modrinth = modPlatforms.getModrinthClient()
    return downloadModrinthModpack(modrinth, modpacks, {
      projectId,
      versionId,
      targetModpackId,
      rootPath: root,
      onProgress: (progress) => {
        if (window && !window.isDestroyed()) {
          window.webContents.send('modpacks:updateProgress', progress)
        }
      },
    })
  })

  // Фаза 4: Создание и экспорт модпаков
  ipcMain.removeHandler('modpacks:exportFromInstance')
  ipcMain.handle('modpacks:exportFromInstance', async (
    _evt,
    modpackId: string,
    name: string,
    version: string,
    author?: string,
    rootPath?: string,
  ) => {
    const root = rootPath || modpacks.getDefaultRootPath()
    return modpacks.exportModpackFromInstance(root, modpackId, name, version, author, modPlatforms)
  })

  ipcMain.removeHandler('modpacks:createLocal')
  ipcMain.handle('modpacks:createLocal', async (
    _evt,
    name: string,
    version: string,
    minecraftVersion: string,
    modLoader?: { type: string; version?: string },
    rootPath?: string,
  ) => {
    const root = rootPath || modpacks.getDefaultRootPath()
    return modpacks.createLocalModpack(root, name, version, minecraftVersion, modLoader as { type: import('../../services/instances/types').ModLoaderType; version?: string } | undefined)
  })

  ipcMain.removeHandler('modpacks:export')
  ipcMain.handle('modpacks:export', async (
    _evt,
    modpackId: string,
    format: 'curseforge' | 'modrinth' | 'zip',
    outputPath: string,
    rootPath?: string,
  ) => {
    const root = rootPath || modpacks.getDefaultRootPath()
    await modpacks.exportModpack(root, modpackId, format, outputPath, modPlatforms)
    return { ok: true }
  })

  ipcMain.removeHandler('modpacks:getModpackInfoFromFile')
  ipcMain.handle('modpacks:getModpackInfoFromFile', async (_evt, filePath: string) => {
    return modpacks.getModpackInfoFromFile(filePath)
  })

  ipcMain.removeHandler('modpacks:import')
  ipcMain.handle('modpacks:import', async (
    _evt,
    filePath: string,
    targetModpackId?: string,
    rootPath?: string,
  ) => {
    const root = rootPath || modpacks.getDefaultRootPath()
    return modpacks.importModpack(root, filePath, targetModpackId, modPlatforms)
  })

  ipcMain.removeHandler('modpacks:addMod')
  ipcMain.handle('modpacks:addMod', async (
    _evt,
    modpackId: string,
    mod: { platform: 'curseforge' | 'modrinth'; projectId: string | number; versionId: string | number },
    rootPath?: string,
  ) => {
    const root = rootPath || modpacks.getDefaultRootPath()
    modpacks.addModToModpack(root, modpackId, mod)
    return { ok: true }
  })

  ipcMain.removeHandler('modpacks:removeMod')
  ipcMain.handle('modpacks:removeMod', async (
    _evt,
    modpackId: string,
    modPath: string,
    rootPath?: string,
  ) => {
    const root = rootPath || modpacks.getDefaultRootPath()
    modpacks.removeModFromModpack(root, modpackId, modPath)
    return { ok: true }
  })

  ipcMain.removeHandler('modpacks:updateOverrides')
  ipcMain.handle('modpacks:updateOverrides', async (
    _evt,
    modpackId: string,
    overrides: Record<string, string>, // base64 encoded
    rootPath?: string,
  ) => {
    const root = rootPath || modpacks.getDefaultRootPath()
    // Преобразовать base64 строки в Buffer
    const overridesBuffers: Record<string, Buffer> = {}
    for (const [filePath, base64Content] of Object.entries(overrides)) {
      overridesBuffers[filePath] = Buffer.from(base64Content, 'base64')
    }
    modpacks.updateModpackOverrides(root, modpackId, overridesBuffers)
    return { ok: true }
  })

  // Получение списка модов в модпаке
  ipcMain.removeHandler('modpacks:getMods')
  ipcMain.handle('modpacks:getMods', async (_evt, modpackId: string, rootPath?: string) => {
    const root = rootPath || modpacks.getDefaultRootPath()
    return modpacks.getModpackMods(root, modpackId)
  })

  // Резервное копирование модпака
  ipcMain.removeHandler('modpacks:backup')
  ipcMain.handle('modpacks:backup', async (_evt, modpackId: string, rootPath?: string) => {
    const root = rootPath || modpacks.getDefaultRootPath()
    const backupPath = await modpacks.backupModpack(root, modpackId)
    return { backupPath }
  })
}

// Legacy alias for backward compatibility
export const registerInstancesHandlers = registerModpacksHandlers;

