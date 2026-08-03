import { ipcMain } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { consumeAuthorizedSavePath } from '../../security/savePathAuthorizations'
import { validateBoundedString } from '../validation/privilegedPayloads'

const MAX_TEXT_EXPORT_BYTES = 16 * 1024 * 1024

export function registerAppHandlers() {
    ipcMain.handle('app:saveFile', async (_evt, filePath: unknown, content: unknown) => {
        const safePath = consumeAuthorizedSavePath(validateBoundedString(filePath, 'Save path', { maxLength: 4_096 }))
        const safeContent = validateBoundedString(content, 'File content', {
            allowEmpty: true,
            maxLength: MAX_TEXT_EXPORT_BYTES,
            allowControlChars: true,
            trim: false,
        })
        if (Buffer.byteLength(safeContent, 'utf8') > MAX_TEXT_EXPORT_BYTES) {
            throw new Error('File content exceeds the export size limit')
        }

        // Ensure directory exists
        const dir = path.dirname(safePath)
        try {
            if (!fs.existsSync(dir)) {
                await fs.promises.mkdir(dir, { recursive: true })
            }
            await fs.promises.writeFile(safePath, safeContent, { encoding: 'utf-8', flag: 'w' })
        } catch (error) {
            console.error('Failed to write file:', error)
            throw error
        }
        return { ok: true }
    })
}
