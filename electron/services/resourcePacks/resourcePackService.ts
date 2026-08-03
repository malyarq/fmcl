import * as fs from 'fs-extra';
import * as path from 'path';
import type {
    ResourcePackAcquisitionIssue,
    ResourcePackAcquisitionIssueStatus,
    ResourcePackAcquisitionResult,
} from '../../../shared/contracts/resourcePacks';
import { ResourcePack } from '../../../shared/types/resourcePack';
import {
    assertAbsolutePath,
    assertChildName,
    assertChildNameList,
    resolvePathWithinRoot,
} from '../../security/pathGuards';
import { resolveApprovedInstancePath, resolveResourcePacksDir } from '../instances/paths';
import { openValidatedZip } from '../../security/archivePolicy';

export class ResourcePacksService {
    private createAcquisitionIssue(
        fileName: string,
        status: ResourcePackAcquisitionIssueStatus,
        message: string,
    ): ResourcePackAcquisitionIssue {
        return { fileName, status, message };
    }

    private createAcquisitionResult(
        status: ResourcePackAcquisitionResult['status'],
        importedFileNames: string[] = [],
        issues: ResourcePackAcquisitionIssue[] = [],
    ): ResourcePackAcquisitionResult {
        return { status, importedFileNames, issues };
    }

    /**
     * Get the resourcepacks directory for an instance
     */
    private getResourcePacksDir(instancePath: string): string {
        return resolveResourcePacksDir(instancePath);
    }

    /**
     * Get options.txt path
     */
    private getOptionsPath(instancePath: string): string {
        return resolvePathWithinRoot(
            resolveApprovedInstancePath(instancePath),
            'options.txt',
            'Resource pack options path',
        );
    }
    // ...
    /**
     * Parse pack.mcmeta from a zip file or directory
     */
    private async getPackMetadata(filePath: string): Promise<{ description?: string; packFormat: number; icon?: Buffer } | null> {
        try {
            const stats = await fs.stat(filePath);

            if (stats.isDirectory()) {
                const mcmetaPath = path.join(filePath, 'pack.mcmeta');
                if (await fs.pathExists(mcmetaPath)) {
                    const content = await fs.readJson(mcmetaPath);
                    const iconPath = path.join(filePath, 'pack.png');
                    const icon = (await fs.pathExists(iconPath)) ? await fs.readFile(iconPath) : undefined;

                    return {
                        description: content.pack?.description,
                        packFormat: content.pack?.pack_format || 0,
                        icon,
                    };
                }
            } else if (filePath.endsWith('.zip')) {
                const zip = await openValidatedZip(filePath, 'Resource pack archive');
                try {
                    const mcmetaEntry = zip.getEntry('pack.mcmeta');
                    if (mcmetaEntry) {
                        const content = JSON.parse((await zip.getData(mcmetaEntry, 1024 * 1024)).toString('utf8'));
                        const iconEntry = zip.getEntry('pack.png');
                        const icon = iconEntry ? await zip.getData(iconEntry, 16 * 1024 * 1024) : undefined;

                        return {
                            description: content.pack?.description,
                            packFormat: content.pack?.pack_format || 0,
                            icon,
                        };
                    }
                } finally {
                    zip.close();
                }
            }
        } catch (e) {
            console.warn(`Failed to read metadata for ${filePath}`, e);
        }
        return null;
    }

    /**
     * Read enabled packs from options.txt
     * Returns list of filenames (e.g. "file/my-pack.zip") or "vanilla"
     */
    private async getEnabledPacks(instancePath: string): Promise<string[]> {
        try {
            const optionsPath = this.getOptionsPath(instancePath);
            if (!(await fs.pathExists(optionsPath))) return [];

            const content = await fs.readFile(optionsPath, 'utf8');
            const lines = content.split(/\r?\n/);
            const rpLine = lines.find(l => l.startsWith('resourcePacks:'));

            if (rpLine) {
                // resourcePacks:["vanilla","file/pack.zip"]
                const jsonStr = rpLine.substring('resourcePacks:'.length);
                try {
                    return JSON.parse(jsonStr) as string[];
                } catch (e) {
                    console.error('Failed to parse resourcePacks line', e);
                }
            }
        } catch (e) {
            console.error('Failed to read options.txt', e);
        }
        return [];
    }

    /**
     * Write enabled packs to options.txt
     */
    private async setEnabledPacks(instancePath: string, packs: string[]): Promise<void> {
        const optionsPath = this.getOptionsPath(instancePath);
        // If options.txt doesn't exist, create it? Usually MC creates it. 
        // If we create it partial, MC might accept it.

        let content = '';
        if (await fs.pathExists(optionsPath)) {
            content = await fs.readFile(optionsPath, 'utf8');
        }

        const newVal = JSON.stringify(packs);
        const lines = content.split(/\r?\n/);
        const idx = lines.findIndex(l => l.startsWith('resourcePacks:'));

        if (idx !== -1) {
            lines[idx] = `resourcePacks:${newVal}`;
        } else {
            lines.push(`resourcePacks:${newVal}`);
        }

        await fs.writeFile(optionsPath, lines.join('\n'));
    }

    async list(instancePath: string): Promise<ResourcePack[]> {
        const dir = this.getResourcePacksDir(instancePath);
        await fs.ensureDir(dir);

        const files = await fs.readdir(dir);
        const enabledPacksRaw = await this.getEnabledPacks(instancePath);
        // Normalize enabled packs: "file/name.zip" -> "name.zip"
        // MC stores local packs as "file/PackName.zip"
        const enabledPacks = new Set(
            enabledPacksRaw
                .filter(p => p.startsWith('file/'))
                .map(p => p.substring(5))
        );

        const result: ResourcePack[] = [];

        for (const file of files) {
            // Skip .DS_Store etc
            if (file.startsWith('.')) continue;

            let filePath: string;
            try {
                filePath = resolvePathWithinRoot(dir, file, 'Resource pack path');
            } catch {
                continue;
            }

            const metadata = await this.getPackMetadata(filePath);
            const stats = await fs.stat(filePath);

            let iconUrl = undefined;
            if (metadata?.icon) {
                iconUrl = `data:image/png;base64,${metadata.icon.toString('base64')}`;
            }

            result.push({
                fileName: file,
                name: file.replace(/\.zip$/, ''), // Or use description? Usually filename is strictly used for ID
                description: metadata?.description,
                packFormat: metadata?.packFormat || 0,
                path: filePath,
                iconUrl,
                isEnabled: enabledPacks.has(file),
                size: stats.size,
            });
        }

        // Sort: 
        // 1. Enabled packs (in reverse order of resourcePacks array - Top priority first)
        // 2. Disabled packs (alphabetical)

        // Create a map for order
        const orderMap = new Map<string, number>();
        enabledPacksRaw.forEach((p, i) => {
            if (p.startsWith('file/')) {
                orderMap.set(p.substring(5), i);
            }
        });

        result.sort((a, b) => {
            const aIdx = orderMap.get(a.fileName);
            const bIdx = orderMap.get(b.fileName);

            if (aIdx !== undefined && bIdx !== undefined) {
                // Both enabled: Higher index in options.txt = Higher priority = Top of UI list?
                // Wait, typical MC UI: Top item = Highest Priority.
                // options.txt: Last item = Highest Priority (overrides others).
                // So UI Top = options.txt components[length-1].
                // So we want descending index order for UI.
                return bIdx - aIdx;
            }
            if (aIdx !== undefined) return -1; // a enabled, b disabled -> a first
            if (bIdx !== undefined) return 1;  // b enabled, a disabled -> b first

            return a.name.localeCompare(b.name);
        });

        return result;
    }

    async enable(fileName: string, instancePath: string): Promise<boolean> {
        const safeFileName = assertChildName(fileName, 'Resource pack name');
        const current = await this.getEnabledPacks(instancePath);
        if (!current.includes('vanilla')) {
            // Always ensure vanilla is there, usually first?
            // Actually MC manages checking vanilla, but valid list usually has it.
            // We'll leave it if exists, add if missing? 
            // Safer to just append our pack.
        }

        const packEntry = `file/${safeFileName}`;
        if (!current.includes(packEntry)) {
            // Add to end (Highest priority)
            current.push(packEntry);
            await this.setEnabledPacks(instancePath, current);
            return true;
        }
        return false;
    }

    async disable(fileName: string, instancePath: string): Promise<boolean> {
        const safeFileName = assertChildName(fileName, 'Resource pack name');
        const current = await this.getEnabledPacks(instancePath);
        const packEntry = `file/${safeFileName}`;
        const newPacks = current.filter(p => p !== packEntry);

        if (newPacks.length !== current.length) {
            await this.setEnabledPacks(instancePath, newPacks);
            return true;
        }
        return false;
    }

    async reorder(fileNames: string[], instancePath: string): Promise<boolean> {
        const safeFileNames = assertChildNameList(fileNames, 'Resource pack name');
        // fileNames comes from UI: Top to Bottom (High Priority -> Low Priority).
        // options.txt expects: Bottom to Top (Low Priority -> High Priority).
        // So we reverse the input list.

        // We also need to preserve "vanilla" or any other non-file entries (like "high_contrast"?)
        // This is tricky. simpler approach:
        // Read current `options.txt` to find "vanilla" and position?
        // Usually "vanilla" is at index 0 (lowest priority).

        const current = await this.getEnabledPacks(instancePath);
        const nonFilePacks = current.filter(p => !p.startsWith('file/'));

        // We assume fileNames ONLY contains the "file/..." packs (passed as just filenames).
        const newFilePacks = safeFileNames.map(f => `file/${f}`).reverse(); // Reverse for options.txt format

        // Combine: [Non-File Packs (vanilla)], [File Packs]
        // This assumes vanilla is always lowest.
        const newOrder = [...nonFilePacks, ...newFilePacks];

        await this.setEnabledPacks(instancePath, newOrder);
        return true;
    }

    async import(filePath: string, instancePath: string): Promise<ResourcePackAcquisitionResult> {
        const fallbackFileName = path.basename(filePath || 'resource-pack.zip') || 'resource-pack.zip';

        try {
            const dir = this.getResourcePacksDir(instancePath);
            await fs.ensureDir(dir);

            const safeSourcePath = assertAbsolutePath(filePath, 'Resource pack source path');
            const fileName = assertChildName(path.basename(safeSourcePath), 'Resource pack name');
            const destinationPath = resolvePathWithinRoot(dir, fileName, 'Resource pack path');

            if (await fs.pathExists(destinationPath)) {
                return this.createAcquisitionResult('duplicate', [], [
                    this.createAcquisitionIssue(
                        fileName,
                        'duplicate',
                        'A resource pack with this file name already exists in the instance.',
                    ),
                ]);
            }

            const metadata = await this.getPackMetadata(safeSourcePath);
            if (!metadata) {
                return this.createAcquisitionResult('invalid-archive', [], [
                    this.createAcquisitionIssue(
                        fileName,
                        'invalid-archive',
                        'The selected archive is missing a readable pack.mcmeta file.',
                    ),
                ]);
            }

            await fs.copy(safeSourcePath, destinationPath);
            return this.createAcquisitionResult('success', [fileName], []);
        } catch {
            return this.createAcquisitionResult('failure', [], [
                this.createAcquisitionIssue(
                    fallbackFileName,
                    'failure',
                    'FMCL could not import the selected resource pack into this instance.',
                ),
            ]);
        }
    }

    async delete(fileName: string, instancePath: string): Promise<boolean> {
        const dir = this.getResourcePacksDir(instancePath);
        const safeFileName = assertChildName(fileName, 'Resource pack name');
        const filePath = resolvePathWithinRoot(dir, safeFileName, 'Resource pack path');
        await fs.remove(filePath);
        // Also disable if enabled
        await this.disable(safeFileName, instancePath);
        return true;
    }
}

export const resourcePacksService = new ResourcePacksService();
