import { ipcMain } from 'electron'
import type { ModInstallRequest, ModInstallResponse } from '../../../shared/contracts/mods'
import type { ModPlatformService } from '../../services/mods/platform/modPlatformService'
import { assertChildName } from '../../security/pathGuards'
import { validateEnum, validateIdentifier } from '../validation/privilegedPayloads'

type ModInstallService = Pick<ModPlatformService, 'installModFile' | 'searchMods' | 'getModVersions'>

function modInstallRequest(value: unknown): ModInstallRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Mod install request must be an object')
  }

  const record = value as Record<string, unknown>
  const allowedKeys = ['instanceId', 'platform', 'projectId', 'versionId', 'contentType']
  const unsupported = Object.keys(record).filter((key) => !allowedKeys.includes(key))
  if (unsupported.length > 0) {
    throw new Error(`Mod install request contains unsupported fields: ${unsupported.join(', ')}`)
  }

  return {
    instanceId: assertChildName(validateIdentifier(record.instanceId, 'Instance ID'), 'Instance ID'),
    platform: validateEnum(record.platform, 'Mod platform', ['curseforge', 'modrinth'] as const),
    projectId: assertChildName(validateIdentifier(record.projectId, 'Mod project ID'), 'Mod project ID'),
    versionId: assertChildName(validateIdentifier(record.versionId, 'Mod version ID'), 'Mod version ID'),
    contentType: validateEnum(record.contentType, 'Mod content type', ['mod', 'resourcepack', 'shader'] as const),
  }
}

function publicInstallResult(result: Awaited<ReturnType<ModInstallService['installModFile']>>): ModInstallResponse {
  if ('status' in result) {
    return {
      status: result.status,
      filename: result.filename,
      issues: result.issues,
    }
  }

  return { status: 'success', filename: result.filename, issues: [] }
}

export function registerModsHandlers(deps: { modPlatforms: ModInstallService; getDefaultRootPath: () => string }) {
  const { modPlatforms, getDefaultRootPath } = deps

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
    return publicInstallResult(await modPlatforms.installModFile(modInstallRequest(req), getDefaultRootPath()))
  })
}
