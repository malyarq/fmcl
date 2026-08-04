import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { assertAbsolutePath, assertRelativePath, resolvePathWithinRoot } from '../../../security/pathGuards';
import { resolveApprovedInstancePath, resolveLauncherRootPath } from '../paths';
import { openValidatedZip, type ValidatedZip, type ValidatedZipEntry } from '../../../security/archivePolicy';
import type { InstanceApplication } from '../../../domains/instances/instanceApplication';
import type { CanonicalInstanceRecord, LauncherRoot } from '../../../domains/instances/instanceTypes';
import type { ModLoaderType } from '../types';

/** Main-process archive and content authority; it is never available to the renderer. */
export interface ArchiveImportContentPort {
    resolveRoot(rootPath: string): Promise<LauncherRoot>;
    inspectArchive(filePath: string): Promise<{ format: string | null }>;
    importArchive(root: LauncherRoot, filePath: string): Promise<{ id: string }>;
    getInstanceDirectory(root: LauncherRoot, instanceId: string): string;
    publishInstance(root: LauncherRoot, record: CanonicalInstanceRecord): Promise<void>;
    removeInstance(root: LauncherRoot, instanceId: string): Promise<void>;
}

type MultiMCComponent = {
    uid?: string;
    version?: string;
};

type MultiMCExtractionTask = {
    entry: ValidatedZipEntry;
    relativePath: string;
};

function normalizeArchiveRelativePath(value: string, label: string): string {
    const trimmedValue = value.replace(/[\\/]+$/, '');
    if (!trimmedValue) {
        throw new Error(`${label} must stay inside the launcher root`);
    }

    return assertRelativePath(trimmedValue, label).split(path.sep).join('/');
}

function asMultiMCComponents(value: unknown): MultiMCComponent[] {
    if (!Array.isArray(value)) {
        return [];
    }

    return value.filter((component): component is MultiMCComponent => (
        typeof component === 'object'
        && component !== null
    ));
}

function findComponent(components: MultiMCComponent[], uid: string): MultiMCComponent | undefined {
    return components.find((component) => component.uid === uid);
}

function collectMultiMCExtractionTasks(zip: ValidatedZip, zipRoot: string): MultiMCExtractionTask[] {
    const minecraftPrefix = zipRoot ? `${zipRoot}/.minecraft/` : '.minecraft/';
    const tasks: MultiMCExtractionTask[] = [];

    for (const entry of zip.getEntries()) {
        const normalizedEntryPath = normalizeArchiveRelativePath(entry.fileName, 'Archive entry path');
        if (!normalizedEntryPath.startsWith(minecraftPrefix)) {
            continue;
        }

        const relativePath = normalizedEntryPath.substring(minecraftPrefix.length);
        if (!relativePath || entry.fileName.endsWith('/')) {
            continue;
        }

        tasks.push({ entry, relativePath });
    }

    return tasks;
}

export class InstanceImporterService {
    constructor(
        private readonly application: InstanceApplication,
        private readonly content: ArchiveImportContentPort,
    ) { }

    /**
     * Import instance from file
     * @returns The ID of the imported instance
     */
    public async importInstance(
        rootPath: string,
        filePath: string,
        targetName?: string
    ): Promise<string> {
        const safeRootPath = resolveLauncherRootPath(rootPath);
        const root = await this.content.resolveRoot(safeRootPath);
        const safeFilePath = assertAbsolutePath(filePath, 'Modpack import path');

        if (!fs.existsSync(safeFilePath)) {
            throw new Error(`File not found: ${safeFilePath}`);
        }

        const ext = path.extname(safeFilePath).toLowerCase();

        // Check if it's a MultiMC/Prism zip
        const zip = await openValidatedZip(safeFilePath, 'Instance archive');
        try {
            const mmcPack = zip.getEntry('mmc-pack.json');
            const mmcPackDeep = zip.getEntries().find((entry) => entry.fileName.endsWith('mmc-pack.json') && !entry.fileName.includes('__MACOSX'));
            if (mmcPack || mmcPackDeep) {
                return await this.importMultiMC(root, zip, targetName || path.basename(safeFilePath, ext));
            }
        } finally {
            zip.close();
        }

        // Check if it's a CurseForge/Modrinth modpack
        const format = (await this.content.inspectArchive(safeFilePath)).format;
        if (format) {
            const result = await this.content.importArchive(root, safeFilePath);
            return result.id;
        }

        throw new Error('Unsupported format');
    }

    private async importMultiMC(
        root: LauncherRoot,
        zip: ValidatedZip,
        name: string
    ): Promise<string> {
        // Determine zip root (where mmc-pack.json is)
        let mmcPackEntry = zip.getEntry('mmc-pack.json');
        let zipRoot = '';

        if (!mmcPackEntry) {
            const found = zip.getEntries().find((entry) => entry.fileName.endsWith('mmc-pack.json') && !entry.fileName.includes('__MACOSX'));
            if (found) {
                mmcPackEntry = found;
                const normalizedManifestPath = normalizeArchiveRelativePath(found.fileName, 'MultiMC manifest path');
                zipRoot = path.posix.dirname(normalizedManifestPath);
                if (zipRoot === '.') zipRoot = '';
            } else {
                throw new Error('Invalid MultiMC pack: missing mmc-pack.json');
            }
        }

        const parsedPack: unknown = JSON.parse((await zip.getData(mmcPackEntry, 8 * 1024 * 1024)).toString('utf8'));
        const mmcPack = typeof parsedPack === 'object' && parsedPack !== null
            ? parsedPack as { components?: unknown }
            : {};

        const components = asMultiMCComponents(mmcPack.components);
        const mcComponent = findComponent(components, 'net.minecraft');
        const forge = findComponent(components, 'net.minecraftforge');
        const fabric = findComponent(components, 'net.fabricmc.fabric-loader');
        const quilt = findComponent(components, 'org.quiltmc.quilt-loader');
        const neoforge = findComponent(components, 'net.neoforged.neoforge');
        const extractionTasks = collectMultiMCExtractionTasks(zip, zipRoot);

        let modLoader: { type: ModLoaderType; version?: string } | undefined;
        if (forge) modLoader = { type: 'forge', version: forge.version };
        if (fabric) modLoader = { type: 'fabric', version: fabric.version };
        if (quilt) modLoader = { type: 'quilt', version: quilt.version };
        if (neoforge) modLoader = { type: 'neoforge', version: neoforge.version };

        let createdModpackId: string | null = null;

        try {
            const result = await this.application.execute(root, {
                version: 1,
                type: 'create',
                name,
                source: { source: 'local' },
                config: {
                    runtime: {
                        minecraftVersion: mcComponent?.version || '1.20.1',
                        ...(modLoader ? { modLoader } : {}),
                    },
                },
            });
            const record = result.snapshot.records.at(-1);
            if (!record) throw new Error('Canonical instance creation returned no record');
            const { id } = record;
            createdModpackId = id;
            await this.content.publishInstance(root, record);

            const instanceDir = resolveApprovedInstancePath(this.content.getInstanceDirectory(root, id));

            for (const task of extractionTasks) {
                const targetPath = resolvePathWithinRoot(
                    instanceDir,
                    task.relativePath,
                    `Archive entry "${task.entry.fileName}"`,
                );

                fs.mkdirSync(path.dirname(targetPath), { recursive: true });
                const output = fs.createWriteStream(targetPath, { flags: 'wx' });
                try {
                    const input = await zip.openReadStream(task.entry);
                    await pipeline(input, output);
                } catch (error) {
                    output.destroy();
                    await fs.promises.rm(targetPath, { force: true });
                    throw error;
                }
            }

            return id;
        } catch (error) {
            if (createdModpackId) {
                await this.application.execute(root, { version: 1, type: 'delete', id: createdModpackId });
                await this.content.removeInstance(root, createdModpackId);
            }
            throw error;
        }
    }
}
