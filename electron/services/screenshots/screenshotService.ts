import { shell } from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';
import { assertChildName, resolvePathWithinRoot } from '../../security/pathGuards';
import { resolveScreenshotsDir } from '../instances/paths';


export interface Screenshot {
    name: string;
    path: string;
    url: string; // file:// url for frontend
    createdAt: number;
    size: number;
}

export class ScreenshotService {
    constructor() { }

    private getScreenshotsDir(instancePath: string): string {
        return resolveScreenshotsDir(instancePath);
    }

    private hasSupportedImageExtension(fileName: string): boolean {
        const lowerName = fileName.toLowerCase();
        return lowerName.endsWith('.png') || lowerName.endsWith('.jpg');
    }

    async listScreenshots(instancePath: string): Promise<Screenshot[]> {
        const dir = this.getScreenshotsDir(instancePath);
        try {
            await fs.access(dir);
        } catch {
            return [];
        }

        const files = await fs.readdir(dir);
        const screenshots: Screenshot[] = [];

        for (const file of files) {
            if (!this.hasSupportedImageExtension(file)) continue;

            let filePath: string;
            try {
                filePath = resolvePathWithinRoot(dir, file, 'Screenshot path');
                const stats = await fs.stat(filePath);
                screenshots.push({
                    name: file,
                    path: filePath,
                    url: `file://${filePath}`,
                    createdAt: stats.birthtimeMs,
                    size: stats.size,
                });
            } catch (e) {
                console.error(`Failed to stat screenshot ${file}:`, e);
            }
        }

        return screenshots.sort((a, b) => b.createdAt - a.createdAt);
    }

    async deleteScreenshot(instancePath: string, filename: string): Promise<void> {
        const dir = this.getScreenshotsDir(instancePath);
        const safeFileName = assertChildName(filename, 'Screenshot name');
        const filePath = resolvePathWithinRoot(dir, safeFileName, 'Screenshot path');
        await fs.unlink(filePath);
    }

    async renameScreenshot(instancePath: string, oldName: string, newName: string): Promise<void> {
        const dir = this.getScreenshotsDir(instancePath);
        const safeOldName = assertChildName(oldName, 'Screenshot name');
        const safeRequestedName = assertChildName(newName, 'Screenshot name');
        const oldPath = resolvePathWithinRoot(dir, safeOldName, 'Screenshot path');
        let normalizedNewName = safeRequestedName;

        // Simple validation
        if (!this.hasSupportedImageExtension(normalizedNewName)) {
            const oldExtension = path.extname(safeOldName);
            if (oldExtension === '.png' || oldExtension === '.jpg') {
                normalizedNewName += oldExtension;
            }
        }

        const safeNewName = assertChildName(normalizedNewName, 'Screenshot name');
        const newPath = resolvePathWithinRoot(dir, safeNewName, 'Screenshot path');
        await fs.rename(oldPath, newPath);
    }

    async openScreenshotFolder(instancePath: string): Promise<void> {
        const dir = this.getScreenshotsDir(instancePath);
        await fs.mkdir(dir, { recursive: true });
        await shell.openPath(dir);
    }

}

export const screenshotService = new ScreenshotService();
