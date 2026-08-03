import { ipcMain } from 'electron'
import type { ModpackService } from '../../services/modpacks/modpackService'
import type { ModPlatformService } from '../../services/mods/platform/modPlatformService'
import {
  validateAddModPayload,
  validateBoolean,
  validateBootstrapSeed,
  validateBoundedString,
  validateEnum,
  validateFilesystemPath,
  validateIdentifier,
  validateInteger,
  validateModpackConfig,
  validateModpackManifest,
  validateModpackMetadataUpdates,
  validateOptionalBoundedString,
  validateOptionalModLoaderConfig,
  validateOptionalRootPath,
  validateOverrideEntries,
  validateRelativeChildPath,
} from '../validation/privilegedPayloads'

const MODPACK_SEARCH_SORTS = ['popularity', 'date', 'alphabetical'] as const

function requireFilesystemPath(value: unknown, label: string): string {
  const candidate = validateFilesystemPath(value, label)
  if (!candidate) {
    throw new Error(`${label} is required.`)
  }

  return candidate
}

function validateOptionalSearchSort(
  value: unknown,
): 'popularity' | 'date' | 'alphabetical' | undefined {
  if (value === undefined) {
    return undefined
  }

  return validateEnum(value, 'Modpack search sort', MODPACK_SEARCH_SORTS)
}

function validateOptionalOffset(value: unknown): number | undefined {
  if (value === undefined) {
    return undefined
  }

  return validateInteger(value, 'Modpack search offset', { min: 0, max: 10_000 })
}

function validateOptionalLimit(value: unknown): number | undefined {
  if (value === undefined) {
    return undefined
  }

  return validateInteger(value, 'Modpack search limit', { min: 1, max: 200 })
}

export function registerModpacksHandlers(deps: {
  modpacks: ModpackService
  modPlatforms: ModPlatformService
}) {
  const { modpacks, modPlatforms } = deps
  const resolveRootPath = (rootPath?: unknown) => (
    validateOptionalRootPath(rootPath) ?? modpacks.getDefaultRootPath()
  )

  ipcMain.removeHandler('modpacks:list')
  ipcMain.handle('modpacks:list', async (_evt, rootPath?: unknown) => {
    return modpacks.listModpacks(resolveRootPath(rootPath))
  })

  ipcMain.removeHandler('modpacks:getModpackInfoFromFile')
  ipcMain.handle('modpacks:getModpackInfoFromFile', async (_evt, filePath: unknown) => {
    return await modpacks.getModpackInfoFromFile(requireFilesystemPath(filePath, 'Modpack file path'))
  })

  ipcMain.removeHandler('modpacks:listWithMetadata')
  ipcMain.handle('modpacks:listWithMetadata', async (_evt, rootPath?: unknown) => {
    return modpacks.listModpacksWithMetadata(resolveRootPath(rootPath))
  })

  ipcMain.removeHandler('modpacks:bootstrap')
  ipcMain.handle('modpacks:bootstrap', async (_evt, seed?: unknown, rootPath?: unknown) => {
    return modpacks.bootstrapModpacks(resolveRootPath(rootPath), validateBootstrapSeed(seed))
  })

  ipcMain.removeHandler('modpacks:getSelected')
  ipcMain.handle('modpacks:getSelected', async (_evt, rootPath?: unknown) => {
    return modpacks.getSelectedModpackId(resolveRootPath(rootPath))
  })

  ipcMain.removeHandler('modpacks:setSelected')
  ipcMain.handle('modpacks:setSelected', async (_evt, modpackId: unknown, rootPath?: unknown) => {
    modpacks.setSelectedModpack(resolveRootPath(rootPath), validateIdentifier(modpackId, 'Modpack id'))
    return { ok: true }
  })

  ipcMain.removeHandler('modpacks:create')
  ipcMain.handle('modpacks:create', async (_evt, name: unknown, rootPath?: unknown) => {
    return modpacks.createModpack(
      resolveRootPath(rootPath),
      validateBoundedString(name, 'Modpack name', { maxLength: 120 }),
    )
  })

  ipcMain.removeHandler('modpacks:rename')
  ipcMain.handle('modpacks:rename', async (_evt, modpackId: unknown, name: unknown, rootPath?: unknown) => {
    return modpacks.renameModpack(
      resolveRootPath(rootPath),
      validateIdentifier(modpackId, 'Modpack id'),
      validateBoundedString(name, 'Modpack name', { maxLength: 120 }),
    )
  })

  ipcMain.removeHandler('modpacks:getConfig')
  ipcMain.handle('modpacks:getConfig', async (_evt, modpackId: unknown, rootPath?: unknown) => {
    return modpacks.loadModpackConfig(resolveRootPath(rootPath), validateIdentifier(modpackId, 'Modpack id'))
  })

  ipcMain.removeHandler('modpacks:saveConfig')
  ipcMain.handle('modpacks:saveConfig', async (_evt, cfg: unknown, rootPath?: unknown) => {
    modpacks.saveModpackConfig(resolveRootPath(rootPath), validateModpackConfig(cfg))
    return { ok: true }
  })

  ipcMain.removeHandler('modpacks:getMetadata')
  ipcMain.handle('modpacks:getMetadata', async (_evt, modpackId: unknown, rootPath?: unknown) => {
    return modpacks.getModpackMetadata(resolveRootPath(rootPath), validateIdentifier(modpackId, 'Modpack id'))
  })

  ipcMain.removeHandler('modpacks:updateMetadata')
  ipcMain.handle('modpacks:updateMetadata', async (_evt, modpackId: unknown, updates: unknown, rootPath?: unknown) => {
    return modpacks.updateModpackMetadata(
      resolveRootPath(rootPath),
      validateIdentifier(modpackId, 'Modpack id'),
      validateModpackMetadataUpdates(updates),
    )
  })

  ipcMain.removeHandler('modpacks:searchCurseForge')
  ipcMain.handle('modpacks:searchCurseForge', async (
    _evt,
    query: unknown,
    mcVersion?: unknown,
    loader?: unknown,
    sort?: unknown,
    offset?: unknown,
    limit?: unknown,
  ) => {
    return modPlatforms.searchCurseForgeModpacks(
      validateBoundedString(query, 'Modpack search query', { allowEmpty: true, maxLength: 200 }),
      validateOptionalBoundedString(mcVersion, 'Minecraft version filter', { maxLength: 64 }),
      validateOptionalBoundedString(loader, 'Mod loader filter', { maxLength: 64 }),
      validateOptionalSearchSort(sort),
      validateOptionalOffset(offset),
      validateOptionalLimit(limit),
    )
  })

  ipcMain.removeHandler('modpacks:searchModrinth')
  ipcMain.handle('modpacks:searchModrinth', async (
    _evt,
    query: unknown,
    mcVersion?: unknown,
    loader?: unknown,
    sort?: unknown,
    offset?: unknown,
    limit?: unknown,
  ) => {
    return modPlatforms.searchModrinthModpacks(
      validateBoundedString(query, 'Modpack search query', { allowEmpty: true, maxLength: 200 }),
      validateOptionalBoundedString(mcVersion, 'Minecraft version filter', { maxLength: 64 }),
      validateOptionalBoundedString(loader, 'Mod loader filter', { maxLength: 64 }),
      validateOptionalSearchSort(sort),
      validateOptionalOffset(offset),
      validateOptionalLimit(limit),
    )
  })

  ipcMain.removeHandler('modpacks:getCurseForgeVersions')
  ipcMain.handle('modpacks:getCurseForgeVersions', async (_evt, projectId: unknown) => {
    return modPlatforms.getCurseForgeModpackVersions(
      validateInteger(projectId, 'CurseForge project id', { min: 1 }),
    )
  })

  ipcMain.removeHandler('modpacks:getModrinthVersions')
  ipcMain.handle('modpacks:getModrinthVersions', async (_evt, projectId: unknown) => {
    return modPlatforms.getModrinthModpackVersions(
      validateBoundedString(projectId, 'Modrinth project id', { maxLength: 128 }),
    )
  })

  ipcMain.removeHandler('modpacks:createLocal')
  ipcMain.handle('modpacks:createLocal', async (
    _evt,
    name: unknown,
    version: unknown,
    minecraftVersion: unknown,
    modLoader?: unknown,
    rootPath?: unknown,
  ) => {
    return modpacks.createLocalModpack(
      resolveRootPath(rootPath),
      validateBoundedString(name, 'Modpack name', { maxLength: 120 }),
      validateBoundedString(version, 'Modpack version', { maxLength: 64 }),
      validateBoundedString(minecraftVersion, 'Minecraft version', { maxLength: 64 }),
      validateOptionalModLoaderConfig(modLoader, 'Mod loader'),
    )
  })

  ipcMain.removeHandler('modpacks:createFromManifest')
  ipcMain.handle('modpacks:createFromManifest', async (_evt, manifest: unknown, rootPath?: unknown) => {
    return modpacks.createFromManifest(
      resolveRootPath(rootPath),
      validateModpackManifest(manifest),
      modPlatforms,
    )
  })

  ipcMain.removeHandler('modpacks:addMod')
  ipcMain.handle('modpacks:addMod', async (_evt, modpackId: unknown, mod: unknown, rootPath?: unknown) => {
    modpacks.addModToModpack(
      resolveRootPath(rootPath),
      validateIdentifier(modpackId, 'Modpack id'),
      validateAddModPayload(mod),
    )
    return { ok: true }
  })

  ipcMain.removeHandler('modpacks:removeMod')
  ipcMain.handle('modpacks:removeMod', async (_evt, modpackId: unknown, modPath: unknown, rootPath?: unknown) => {
    modpacks.removeModFromModpack(
      resolveRootPath(rootPath),
      validateIdentifier(modpackId, 'Modpack id'),
      validateRelativeChildPath(modPath, 'Mod path'),
    )
    return { ok: true }
  })

  ipcMain.removeHandler('modpacks:setModEnabled')
  ipcMain.handle('modpacks:setModEnabled', async (
    _evt,
    modpackId: unknown,
    modPath: unknown,
    enabled: unknown,
    rootPath?: unknown,
  ) => {
    modpacks.setModEnabled(
      resolveRootPath(rootPath),
      validateIdentifier(modpackId, 'Modpack id'),
      validateRelativeChildPath(modPath, 'Mod path'),
      validateBoolean(enabled, 'Mod enabled flag'),
    )
    return { ok: true }
  })

  ipcMain.removeHandler('modpacks:updateOverrides')
  ipcMain.handle('modpacks:updateOverrides', async (
    _evt,
    modpackId: unknown,
    overrides: unknown,
    rootPath?: unknown,
  ) => {
    const overridesBuffers: Record<string, Buffer> = {}
    for (const [filePath, base64Content] of Object.entries(validateOverrideEntries(overrides))) {
      overridesBuffers[filePath] = Buffer.from(base64Content, 'base64')
    }

    modpacks.updateModpackOverrides(
      resolveRootPath(rootPath),
      validateIdentifier(modpackId, 'Modpack id'),
      overridesBuffers,
    )
    return { ok: true }
  })

  ipcMain.removeHandler('modpacks:getMods')
  ipcMain.handle('modpacks:getMods', async (_evt, modpackId: unknown, rootPath?: unknown) => {
    return modpacks.getModpackMods(resolveRootPath(rootPath), validateIdentifier(modpackId, 'Modpack id'))
  })

  ipcMain.removeHandler('modpacks:backup')
  ipcMain.handle('modpacks:backup', async (_evt, modpackId: unknown, rootPath?: unknown) => {
    const backupPath = await modpacks.backupModpack(
      resolveRootPath(rootPath),
      validateIdentifier(modpackId, 'Modpack id'),
    )
    return { backupPath }
  })

  ipcMain.removeHandler('modpacks:resolvePath')
  ipcMain.handle('modpacks:resolvePath', async (_evt, modpackId: unknown, rootPath?: unknown) => {
    return modpacks.getModpackDir(resolveRootPath(rootPath), validateIdentifier(modpackId, 'Modpack id'))
  })

  ipcMain.removeHandler('modpacks:scanJava')
  ipcMain.handle('modpacks:scanJava', async () => {
    return modpacks.scanJava()
  })

  ipcMain.removeHandler('modpacks:getContentStats')
  ipcMain.handle('modpacks:getContentStats', async () => {
    return modpacks.getContentStats()
  })

  ipcMain.removeHandler('modpacks:cleanupContent')
  ipcMain.handle('modpacks:cleanupContent', async () => {
    return modpacks.cleanupContent()
  })
}

export const registerInstancesHandlers = registerModpacksHandlers
