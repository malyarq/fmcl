import fs from 'node:fs';
import path from 'node:path';
import AdmZip from 'adm-zip';
import { ModpackService } from '../instanceService';
import type { ModpackConfig } from '../types';

export interface ExportOptions {
    includeSaves?: boolean;
    includeScreenshots?: boolean;
    includeResourcePacks?: boolean;
    includeShaders?: boolean;
    includeMods?: boolean; // Default true
}

export class InstanceExporterService {
    constructor(private modpackService: ModpackService) { }

    /**
     * Export an instance to a specific format
     */
    public async exportInstance(
        rootPath: string,
        instanceId: string,
        format: 'multimc' | 'zip', // We can add curseforge/modrinth later via ModpackService logic if needed, but for now focus on raw instance export
        outputPath: string,
        options: ExportOptions = {}
    ): Promise<void> {
        const config = this.modpackService.loadModpackConfig(rootPath, instanceId);
        if (!config) {
            throw new Error(`Instance not found: ${instanceId}`);
        }

        const instanceDir = this.modpackService.getModpackDir(rootPath, instanceId);

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
        const zip = new AdmZip();
        this.addFilesToZip(zip, instanceDir, '', options);
        zip.writeZip(outputPath);
    }

    private async exportAsMultiMC(
        config: ModpackConfig,
        instanceDir: string,
        outputPath: string,
        options: ExportOptions
    ): Promise<void> {
        const zip = new AdmZip();

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

        zip.addFile('mmc-pack.json', Buffer.from(JSON.stringify(mmcPack, null, 2)));

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

        zip.addFile('instance.cfg', Buffer.from(instanceCfg));

        // 3. Add .minecraft folder contents
        this.addFilesToZip(zip, instanceDir, '.minecraft', options);

        zip.writeZip(outputPath);
    }

    private addFilesToZip(zip: AdmZip, sourceDir: string, targetPrefix: string, options: ExportOptions) {
        if (!fs.existsSync(sourceDir)) return;

        const files = fs.readdirSync(sourceDir);

        for (const file of files) {
            const fullPath = path.join(sourceDir, file);
            const stats = fs.statSync(fullPath);
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
                const content = fs.readFileSync(fullPath);
                const zipPathNormalized = relativePath.replace(/\\/g, '/');
                zip.addFile(zipPathNormalized, content);
            }
        }
    }
}
