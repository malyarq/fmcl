import { ipcMain, type BrowserWindow, app, dialog, shell } from 'electron'
import path from 'path'
import fs from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { isSettingsBackupKey, type SettingsBackupValues } from '@shared/contracts/settings'
import {
  validateOpenDialogOptions,
  validateOptionalRootPath,
  validateSaveDialogOptions,
} from '../validation/privilegedPayloads'
import { authorizeSavePath } from '../../security/savePathAuthorizations'
import { replaceFileAtomically } from '../../security/zipWriter'

const SETTINGS_BACKUP_MAX_BYTES = 512 * 1024
const SETTINGS_BACKUP_MAX_KEYS = 96
const SETTINGS_BACKUP_FIELDS = new Set(['schemaVersion', 'product', 'createdAt', 'values'])

function isCanonicalIsoTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value
}

function hasExactSettingsBackupFields(value: Record<string, unknown>): boolean {
  const fields = Object.keys(value)
  return fields.length === SETTINGS_BACKUP_FIELDS.size
    && fields.every((field) => SETTINGS_BACKUP_FIELDS.has(field))
}

export function validateSettingsBackupValues(value: unknown): SettingsBackupValues {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Settings backup must contain a plain key-value object')
  }
  const entries = Object.entries(value)
  if (entries.length > SETTINGS_BACKUP_MAX_KEYS) throw new Error('Settings backup contains too many keys')

  const values: Record<string, string> = {}
  for (const [key, entry] of entries) {
    if (!isSettingsBackupKey(key) || typeof entry !== 'string') throw new Error(`Settings backup contains an unsupported key: ${key}`)
    if (Buffer.byteLength(entry, 'utf8') > 128 * 1024) throw new Error(`Settings backup value is too large: ${key}`)
    values[key] = entry
  }
  if (Buffer.byteLength(JSON.stringify(values), 'utf8') > SETTINGS_BACKUP_MAX_BYTES) {
    throw new Error('Settings backup is too large')
  }
  return values
}

function parseSettingsBackup(value: unknown): SettingsBackupValues {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid Burrow settings backup')
  const backup = value as Record<string, unknown>
  if (backup.schemaVersion !== 1
    || backup.product !== 'Burrow'
    || !isCanonicalIsoTimestamp(backup.createdAt)
    || !hasExactSettingsBackupFields(backup)) {
    throw new Error('Unsupported Burrow settings backup')
  }
  return validateSettingsBackupValues(backup.values)
}

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
  ipcMain.handle('settings:openMinecraftPath', async (_evt, targetPath?: unknown) => {
    try {
      const pathToOpen = validateOptionalRootPath(targetPath, 'Minecraft directory path')
        ?? path.join(app.getPath('userData'), 'minecraft_data')
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

  ipcMain.removeHandler('settings:exportBackup')
  ipcMain.handle('settings:exportBackup', async (_event, values: unknown) => {
    const safeValues = validateSettingsBackupValues(values)
    const date = new Date().toISOString().slice(0, 10)
    const result = await dialog.showSaveDialog(window, {
      title: 'Export Burrow settings',
      defaultPath: path.join(app.getPath('documents'), `Burrow-settings-${date}.burrow-settings.json`),
      filters: [{ name: 'Burrow settings', extensions: ['json'] }],
    })
    if (result.canceled || !result.filePath) return { canceled: true }

    const backup = JSON.stringify({
      schemaVersion: 1,
      product: 'Burrow',
      createdAt: new Date().toISOString(),
      values: safeValues,
    }, null, 2)
    const temporaryPath = `${result.filePath}.${randomUUID()}.tmp`
    try {
      await fs.writeFile(temporaryPath, `${backup}\n`, { encoding: 'utf8', mode: 0o600, flag: 'wx' })
      await replaceFileAtomically(temporaryPath, result.filePath)
    } catch (error) {
      await fs.rm(temporaryPath, { force: true }).catch(() => undefined)
      throw error
    }
    return { canceled: false, fileName: path.basename(result.filePath) }
  })

  ipcMain.removeHandler('settings:importBackup')
  ipcMain.handle('settings:importBackup', async () => {
    const result = await dialog.showOpenDialog(window, {
      title: 'Import Burrow settings',
      properties: ['openFile'],
      filters: [{ name: 'Burrow settings', extensions: ['json'] }],
    })
    if (result.canceled || result.filePaths.length !== 1) return { canceled: true }

    const filePath = result.filePaths[0]
    const stats = await fs.stat(filePath)
    if (!stats.isFile() || stats.size > SETTINGS_BACKUP_MAX_BYTES) throw new Error('Settings backup is not a supported file')
    let parsed: unknown
    try {
      parsed = JSON.parse(await fs.readFile(filePath, 'utf8')) as unknown
    } catch {
      throw new Error('Settings backup is not valid JSON')
    }
    const values = parseSettingsBackup(parsed)
    return { canceled: false, fileName: path.basename(filePath), values }
  })

  ipcMain.removeHandler('dialog:showSaveDialog')
  ipcMain.handle('dialog:showSaveDialog', async (event, options: unknown) => {
    try {
      const result = await dialog.showSaveDialog(window, validateSaveDialogOptions(options))
      if (!result.canceled && result.filePath) {
        authorizeSavePath(event.sender.id, result.filePath)
      }
      return result
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return { canceled: true, filePath: undefined, error: errorMessage }
    }
  })

  ipcMain.removeHandler('dialog:showOpenDialog')
  ipcMain.handle('dialog:showOpenDialog', async (_evt, options: unknown) => {
    try {
      const result = await dialog.showOpenDialog(window, validateOpenDialogOptions(options))
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
