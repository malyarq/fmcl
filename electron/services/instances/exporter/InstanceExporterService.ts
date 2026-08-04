import fs from 'node:fs';
import path from 'node:path';
import type { ModpackConfig } from '../types';
import { SafeZipWriter } from '../../../security/zipWriter';
import type { InstanceReadPort } from '../../../domains/instances/ports';
import type { CanonicalInstanceRecord, LauncherRoot } from '../../../domains/instances/instanceTypes';

/** Main-process content authority required to export a canonical instance. */
export interface ArchiveExportContentPort {
    resolveRoot(rootPath: string): Promise<LauncherRoot>;
    getInstanceDirectory(root: LauncherRoot, instanceId: string): string;
}

export interface ExportOptions {
    includeSaves?: boolean;
    includeScreenshots?: boolean;
    includeResourcePacks?: boolean;
    includeShaders?: boolean;
    includeMods?: boolean; // Default true
}

export class InstanceExporterService {
    constructor(
        private readonly instanceReadPort: InstanceReadPort,
        private readonly content: ArchiveExportContentPort,
    ) { }

    /**
     * Export an instance to a specific format
     */
    public async exportInstance(
        rootPath: string,
        instanceId: string,
        format: 'multimc' | 'zip', // Other archive formats remain outside this raw instance adapter.
        outputPath: string,
        options: ExportOptions = {}
    ): Promise<void> {
        const root = await this.content.resolveRoot(rootPath);
        const state = await this.instanceReadPort.read(root);
        const record = state.status === 'ready'
            ? state.snapshot.records.find((candidate) => candidate.id === instanceId)
            : undefined;
        if (!record) {
            throw new Error(`Instance not found: ${instanceId}`);
        }
        const config = toExportConfig(record);

        const instanceDir = this.content.getInstanceDirectory(root, instanceId);

        if (format === 'multimc') {
            await this.exportAsMultiMC(config, instanceDir, outputPath, options);
        } else {
            await this.exportAsZip(instanceDir, outputPath, options);
        }
    }

    private async exportAsZip(
        instanceDir: string,
        outputPath: string,
        options: ExportOptions
    ): Promise<void> {
        const zip = new SafeZipWriter();
        this.addFilesToZip(zip, instanceDir, '', options);
        await zip.writeTo(outputPath);
    }

    private async exportAsMultiMC(
        config: ModpackConfig,
        instanceDir: string,
        outputPath: string,
        options: ExportOptions
    ): Promise<void> {
        const zip = new SafeZipWriter();

        // 1. Create mmc-pack.json
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mmcPack: any = {
            components: [
                {
                    cachedName: "Minecraft",
                    cachedRequires: [],
                    cachedVersion: config.runtime.minecraft,
                    important: true,
                    uid: "net.minecraft",
                    version: config.runtime.minecraft
                }
            ],
            formatVersion: 1
        };

        if (config.runtime.modLoader) {
            const loader = config.runtime.modLoader;
            let uid = '';
            let name = '';

            switch (loader.type) {
                case 'forge':
                    uid = 'net.minecraftforge';
                    name = 'Forge';
                    break;
                case 'fabric':
                    uid = 'net.fabricmc.fabric-loader';
                    name = 'Fabric Loader';
                    break;
                case 'quilt':
                    uid = 'org.quiltmc.quilt-loader';
                    name = 'Quilt Loader';
                    break;
                case 'neoforge':
                    uid = 'net.neoforged.neoforge';
                    name = 'NeoForge';
                    break;
            }

            if (uid) {
                mmcPack.components.push({
                    cachedName: name,
                    cachedRequires: [
                        {
                            equals: config.runtime.minecraft,
                            uid: "net.minecraft"
                        }
                    ],
                    cachedVersion: loader.version || '',
                    uid: uid,
                    version: loader.version || ''
                });
            }
        }

        zip.addBuffer('mmc-pack.json', Buffer.from(JSON.stringify(mmcPack, null, 2)));

        // 2. Create instance.cfg
        const instanceCfg = [
            'InstanceType=OneSix',
            `name=${config.name}`,
            `notes=`,
            'OverrideCommands=false',
            'OverrideConsole=false',
            'OverrideJavaArgs=false',
            'OverrideJavaLocation=false',
            'OverrideMemory=false',
            'OverrideWindow=false',
            'iconKey=default',
            'stats=0'
        ].join('\n');

        zip.addBuffer('instance.cfg', Buffer.from(instanceCfg));

        // 3. Add .minecraft folder contents
        this.addFilesToZip(zip, instanceDir, '.minecraft', options);

        await zip.writeTo(outputPath);
    }

    private addFilesToZip(zip: SafeZipWriter, sourceDir: string, targetPrefix: string, options: ExportOptions) {
        if (!fs.existsSync(sourceDir)) return;

        const files = fs.readdirSync(sourceDir);

        for (const file of files) {
            const fullPath = path.join(sourceDir, file);
            const stats = fs.lstatSync(fullPath);
            const relativePath = targetPrefix ? path.join(targetPrefix, file) : file;

            // Filtering
            if (file === 'mods' && options.includeMods === false) continue;
            if (file === 'saves' && !options.includeSaves) continue;
            if (file === 'screenshots' && !options.includeScreenshots) continue;
            if (file === 'resourcepacks' && !options.includeResourcePacks) continue;
            if (file === 'shaderpacks' && !options.includeShaders) continue;

            if (file === 'instance.json' || file === 'config.json') continue; // Skip our own config

            if (stats.isDirectory()) {
                this.addFilesToZip(zip, fullPath, relativePath, options);
            } else {
                const zipPathNormalized = relativePath.replace(/\\/g, '/');
                zip.addFile(zipPathNormalized, fullPath);
            }
        }
    }
}

function toExportConfig(record: CanonicalInstanceRecord): ModpackConfig {
    return {
        id: record.id,
        name: record.name,
        runtime: {
            minecraft: record.config.runtime.minecraftVersion,
            ...(record.config.runtime.modLoader ? { modLoader: { ...record.config.runtime.modLoader } } : {}),
        },
    };
}
