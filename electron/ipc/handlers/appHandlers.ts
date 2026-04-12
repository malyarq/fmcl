import { ipcMain } from 'electron'
import fs from 'node:fs'
import path from 'node:path'

export function registerAppHandlers() {
    ipcMain.handle('app:saveFile', async (_evt, filePath: string, content: string) => {
        // Basic security check: ensure we are writing to a valid path
        // For now, we trust the renderer as it uses dialog.showSaveDialog which users control

        // Ensure directory exists
        const dir = path.dirname(filePath)
        try {
            if (!fs.existsSync(dir)) {
                await fs.promises.mkdir(dir, { recursive: true })
            }
            await fs.promises.writeFile(filePath, content, 'utf-8')
        } catch (error) {
            console.error('Failed to write file:', error)
            throw error
        }
        return { ok: true }
    })
}
