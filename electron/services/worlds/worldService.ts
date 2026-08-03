import path from 'node:path';
import fs from 'node:fs/promises';
import { assertChildName, resolvePathWithinRoot } from '../../security/pathGuards';
import { resolveWorldPath, resolveWorldsDir } from '../instances/paths';
import { SafeZipWriter } from '../../security/zipWriter';

export interface WorldInfo {
    name: string;
    folderName: string;
    lastPlayed?: number;
    gameMode?: number;
    difficulty?: number;
    sizeBytes?: number;
}

export class WorldsService {
    private async addDirectoryToZip(zip: SafeZipWriter, sourceDir: string, prefix: string): Promise<void> {
        const entries = await fs.readdir(sourceDir, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.isSymbolicLink()) throw new Error(`World backup contains a symbolic link: ${entry.name}`);
            const sourcePath = path.join(sourceDir, entry.name);
            const entryPath = path.posix.join(prefix, entry.name);
            if (entry.isDirectory()) await this.addDirectoryToZip(zip, sourcePath, entryPath);
            else zip.addFile(entryPath, sourcePath);
        }
    }

    /**
     * Get the saves directory path for an instance.
     */
    private getSavesDir(instancePath: string): string {
        return resolveWorldsDir(instancePath);
    }

    /**
     * Parse level.dat to extract world metadata.
     * level.dat is NBT format, but we can extract basic info without full NBT parsing.
     */
    private async getWorldMetadata(worldPath: string): Promise<Partial<WorldInfo>> {
        const levelDatPath = path.join(worldPath, 'level.dat');
        try {
            await fs.access(levelDatPath);
            // level.dat exists - this is a valid world
            // For now, return basic info. Full NBT parsing would require additional library.
            const stat = await fs.stat(levelDatPath);
            return {
                lastPlayed: stat.mtimeMs,
            };
        } catch {
            return {};
        }
    }

    /**
     * Calculate total size of a directory recursively.
     */
    private async getDirectorySize(dirPath: string): Promise<number> {
        let totalSize = 0;
        try {
            const entries = await fs.readdir(dirPath, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(dirPath, entry.name);
                if (entry.isDirectory()) {
                    totalSize += await this.getDirectorySize(fullPath);
                } else {
                    const stat = await fs.stat(fullPath);
                    totalSize += stat.size;
                }
            }
        } catch {
            // Ignore errors
        }
        return totalSize;
    }

    /**
     * List all worlds in the instance's saves folder.
     */
    async list(instancePath: string): Promise<WorldInfo[]> {
        const savesDir = this.getSavesDir(instancePath);

        let entries: string[] = [];
        try {
            entries = await fs.readdir(savesDir);
        } catch {
            // Directory doesn't exist
            return [];
        }

        const worlds: WorldInfo[] = [];

        for (const entry of entries) {
            let worldPath: string;
            try {
                worldPath = resolvePathWithinRoot(savesDir, entry, 'World path');
            } catch {
                continue;
            }

            let stat;
            try {
                stat = await fs.stat(worldPath);
            } catch {
                continue;
            }

            if (stat.isDirectory()) {
                // Check if it has level.dat (valid world)
                const levelDatPath = resolvePathWithinRoot(worldPath, 'level.dat', 'World level.dat path');
                try {
                    await fs.access(levelDatPath);

                    const metadata = await this.getWorldMetadata(worldPath);
                    const sizeBytes = await this.getDirectorySize(worldPath);

                    worlds.push({
                        name: entry, // World folder name (often matches in-game name)
                        folderName: entry,
                        lastPlayed: metadata.lastPlayed,
                        sizeBytes,
                    });
                } catch {
                    // Not a valid world (no level.dat)
                }
            }
        }

        // Sort by last played (newest first)
        worlds.sort((a, b) => (b.lastPlayed ?? 0) - (a.lastPlayed ?? 0));

        return worlds;
    }

    /**
     * Delete a world from the instance.
     */
    async delete(folderName: string, instancePath: string): Promise<void> {
        const worldPath = resolveWorldPath(instancePath, folderName);

        await fs.rm(worldPath, { recursive: true, force: true });
    }

    /**
     * Backup a world to a zip file.
     * @returns The path to the created backup file.
     */
    async backup(folderName: string, instancePath: string): Promise<string> {
        const savesDir = this.getSavesDir(instancePath);
        const safeFolderName = assertChildName(folderName, 'World name');
        const worldPath = resolveWorldPath(instancePath, safeFolderName);

        // Create backup in the same saves folder with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const backupName = `${safeFolderName}_backup_${timestamp}.zip`;
        const backupPath = resolvePathWithinRoot(savesDir, backupName, 'World backup path');

        const zip = new SafeZipWriter();
        await this.addDirectoryToZip(zip, worldPath, safeFolderName);
        await zip.writeTo(backupPath);

        return backupPath;
    }

    /**
     * Duplicate a world.
     */
    async duplicate(folderName: string, instancePath: string): Promise<string> {
        const savesDir = this.getSavesDir(instancePath);
        const safeFolderName = assertChildName(folderName, 'World name');
        const worldPath = resolveWorldPath(instancePath, safeFolderName);

        // Find a unique name
        let copyIndex = 1;
        let newName = `${safeFolderName}_copy`;
        while (true) {
            const testPath = resolvePathWithinRoot(savesDir, newName, 'World copy path');
            try {
                await fs.access(testPath);
                copyIndex++;
                newName = `${safeFolderName}_copy_${copyIndex}`;
            } catch {
                break; // Name is available
            }
        }

        const newPath = resolvePathWithinRoot(savesDir, newName, 'World copy path');
        await fs.cp(worldPath, newPath, { recursive: true });

        return newName;
    }

    /**
     * Open the world folder in file explorer.
     */
    getWorldPath(folderName: string, instancePath: string): string {
        return resolveWorldPath(instancePath, folderName);
    }
}

// Singleton export
export const worldsService = new WorldsService();
