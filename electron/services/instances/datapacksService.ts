import fs from 'node:fs';
import path from 'node:path';
import { assertChildName, resolvePathWithinRoot } from '../../security/pathGuards';
import { assertPublicHttpsUrl } from '../../security/remoteUrls';
import { resolveApprovedInstancePath, resolveWorldPath } from './paths';
import { openValidatedZip } from '../../security/archivePolicy';

export interface Datapack {
    fileName: string;
    name: string;
    description: string;
    isEnabled: boolean;
    path: string;
}

type PackMetadata = {
    pack?: {
        description?: string | { text?: string };
    };
};

export class DatapackService {
    /**
     * Get the path to the datapacks directory for a specific world.
     */
    private getDatapacksDir(instancePath: string, worldFolder: string): string {
        const safeInstancePath = resolveApprovedInstancePath(instancePath);
        const worldPath = resolveWorldPath(safeInstancePath, assertChildName(worldFolder, 'World folder'));
        return resolvePathWithinRoot(worldPath, 'datapacks', 'Datapacks directory');
    }

    /**
     * List all datapacks in a world.
     */
    public async list(instancePath: string, worldFolder: string): Promise<Datapack[]> {
        const datapacksDir = this.getDatapacksDir(instancePath, worldFolder);

        if (!fs.existsSync(datapacksDir)) {
            return [];
        }

        const files = await fs.promises.readdir(datapacksDir);
        const validFiles = files.filter(f => !f.startsWith('.')); // Ignore hidden files

        const datapacks: Datapack[] = [];

        for (const file of validFiles) {
            const fullPath = path.join(datapacksDir, file);
            const isEnabled = !file.endsWith('.disabled');
            let name = file;
            let description = '';

            try {
                const stats = await fs.promises.stat(fullPath);

                // Try to read pack.mcmeta
                let packMeta: PackMetadata | null = null;

                if (stats.isDirectory()) {
                    const metaPath = path.join(fullPath, 'pack.mcmeta');
                    if (fs.existsSync(metaPath)) {
                        const content = await fs.promises.readFile(metaPath, 'utf-8');
                        packMeta = JSON.parse(content) as PackMetadata;
                    }
                } else if (file.endsWith('.zip') || file.endsWith('.zip.disabled')) {
                    // Try to read zip
                    try {
                        const zip = await openValidatedZip(fullPath, 'Datapack archive');
                        try {
                            const entry = zip.getEntry('pack.mcmeta');
                            if (entry) {
                                const content = (await zip.getData(entry, 1024 * 1024)).toString('utf8');
                                packMeta = JSON.parse(content) as PackMetadata;
                            }
                        } finally {
                            zip.close();
                        }
                    } catch (e) {
                        console.warn(`Failed to read zip datapack ${file}:`, e);
                    }
                }

                if (packMeta && packMeta.pack) {
                    // Typically description is in pack.description
                    // It can be a string or a JSON text component
                    if (typeof packMeta.pack.description === 'string') {
                        description = packMeta.pack.description;
                    } else if (typeof packMeta.pack.description === 'object') {
                        // Simplified text component handling
                        description = packMeta.pack.description.text || JSON.stringify(packMeta.pack.description);
                    }

                    // Name is usually just the folder/file name in datapacks, 
                    // as they don't have a strict 'name' field in mcmeta like mods.
                    // We keep the file name as the primary identifier, 
                    // but we could try to pretty print it if we wanted.
                }

            } catch (e) {
                console.error(`Error processing datapack ${file}:`, e);
            }

            datapacks.push({
                fileName: file,
                name: name, // Use filename as name generally
                description,
                isEnabled,
                path: fullPath
            });
        }

        return datapacks;
    }

    /**
     * Enable a datapack (remove .disabled suffix).
     */
    public async enable(instancePath: string, worldFolder: string, fileName: string): Promise<void> {
        const datapacksDir = this.getDatapacksDir(instancePath, worldFolder);
        const safeFileName = assertChildName(fileName, 'Datapack name');
        const fullPath = resolvePathWithinRoot(datapacksDir, safeFileName, 'Datapack path');

        if (!safeFileName.endsWith('.disabled')) return; // Already enabled or unknown extension logic

        // Check if target exists
        const targetName = assertChildName(safeFileName.replace(/\.disabled$/, ''), 'Datapack name');
        const targetPath = resolvePathWithinRoot(datapacksDir, targetName, 'Datapack path');

        if (fs.existsSync(targetPath)) {
            throw new Error(`Target file ${targetName} already exists`);
        }

        await fs.promises.rename(fullPath, targetPath);
    }

    /**
     * Disable a datapack (add .disabled suffix).
     */
    public async disable(instancePath: string, worldFolder: string, fileName: string): Promise<void> {
        const datapacksDir = this.getDatapacksDir(instancePath, worldFolder);
        const safeFileName = assertChildName(fileName, 'Datapack name');
        const fullPath = resolvePathWithinRoot(datapacksDir, safeFileName, 'Datapack path');

        if (safeFileName.endsWith('.disabled')) return;

        const targetName = assertChildName(`${safeFileName}.disabled`, 'Datapack name');
        const targetPath = resolvePathWithinRoot(datapacksDir, targetName, 'Datapack path');

        if (fs.existsSync(targetPath)) {
            throw new Error(`Target file ${targetName} already exists`);
        }

        await fs.promises.rename(fullPath, targetPath);
    }

    /**
     * Delete a datapack.
     */
    public async delete(instancePath: string, worldFolder: string, fileName: string): Promise<void> {
        const datapacksDir = this.getDatapacksDir(instancePath, worldFolder);
        const safeFileName = assertChildName(fileName, 'Datapack name');
        const fullPath = resolvePathWithinRoot(datapacksDir, safeFileName, 'Datapack path');

        await fs.promises.rm(fullPath, { recursive: true, force: true });
    }

    /**
   * Install a datapack from a URL (e.g. Modrinth version).
   */
    public async install(instancePath: string, worldFolder: string, fileUrl: string, fileName: string): Promise<void> {
        const datapacksDir = this.getDatapacksDir(instancePath, worldFolder);
        if (!fs.existsSync(datapacksDir)) {
            await fs.promises.mkdir(datapacksDir, { recursive: true });
        }

        const safeFileName = assertChildName(fileName, 'Datapack name');
        if (!safeFileName.toLowerCase().endsWith('.zip')) {
            throw new Error('Datapack download must be a .zip file');
        }
        const safeFileUrl = assertPublicHttpsUrl(fileUrl, 'Datapack download URL', {
            allowedHostSuffixes: ['cdn.modrinth.com'],
        });
        const destPath = resolvePathWithinRoot(datapacksDir, safeFileName, 'Datapack path');

        const { download } = await import('@xmcl/file-transfer');

        await download({
            url: safeFileUrl,
            destination: destPath,
        });
    }
}

export const datapacksService = new DatapackService();
