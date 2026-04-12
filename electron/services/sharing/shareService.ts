import { gzipSync, gunzipSync } from 'zlib';
import { ModpackManifest } from '@shared/types';
import { ModpackService } from '../modpacks/modpackService';
import { InstanceManifestManager } from '../instances/manifestManager';

interface MiniManifestFile {
    p?: number; // projectID (CurseForge)
    f?: number; // fileID (CurseForge)
    m?: string; // Modrinth projectId
    v?: string; // Modrinth versionId
}

interface MiniManifest {
    v: number; // version of format
    n: string; // name
    mc: string; // minecraft version
    ml: {
        t: string; // type
        v?: string; // version
    };
    f: MiniManifestFile[];
}

export class ShareService {
    private manifestManager = new InstanceManifestManager();

    constructor(private modpackService: ModpackService) { }

    public async generateShareCode(modpackId: string): Promise<string> {
        try {
            const rootPath = this.modpackService.getDefaultRootPath();
            const config = this.modpackService.loadModpackConfig(rootPath, modpackId);
            const instanceDir = this.modpackService.getModpackDir(rootPath, modpackId);

            // Load installed mods metadata
            const instanceManifest = this.manifestManager.loadManifest(instanceDir);

            const mini: MiniManifest = {
                v: 1,
                n: config.name,
                mc: config.runtime.minecraft,
                ml: {
                    t: config.runtime.modLoader?.type || 'vanilla',
                    v: config.runtime.modLoader?.version
                },
                f: instanceManifest.mods.map(m => {
                    const file: MiniManifestFile = {};
                    if (m.source === 'curseforge') {
                        file.p = Number(m.projectId);
                        file.f = Number(m.versionId);
                    } else if (m.source === 'modrinth') {
                        file.m = m.projectId;
                        file.v = m.versionId;
                    }
                    return file;
                })
            };

            const jsonString = JSON.stringify(mini);
            const buffer = Buffer.from(jsonString, 'utf-8');
            const compressed = gzipSync(buffer);
            const base64 = compressed.toString('base64');

            return `fmcl://share/v1/${base64}`;
        } catch (error) {
             
            console.error('Failed to generate share code:', error);
            throw new Error('Failed to generate share code');
        }
    }

    public async resolveShareCode(code: string): Promise<ModpackManifest> {
        try {
            let base64 = code;
            if (code.startsWith('fmcl://share/v1/')) {
                base64 = code.replace('fmcl://share/v1/', '');
            }

            const buffer = Buffer.from(base64, 'base64');
            const decompressed = gunzipSync(buffer);
            const jsonString = decompressed.toString('utf-8');
            const mini: MiniManifest = JSON.parse(jsonString);

            if (mini.v !== 1) {
                throw new Error(`Unsupported share code version: ${mini.v}`);
            }

            const manifest: ModpackManifest = {
                formatVersion: 1,
                minecraft: {
                    version: mini.mc,
                    modLoaders: [{
                        id: `${mini.ml.t}${mini.ml.v ? '-' + mini.ml.v : ''}`,
                        primary: true
                    }]
                },
                name: mini.n,
                version: '1.0.0', // Default version for import
                files: mini.f.map(f => ({
                    projectID: f.p,
                    fileID: f.f,
                    projectId: f.m,
                    versionId: f.v,
                    required: true
                })),
                overrides: 'overrides'
            };

            return manifest;
        } catch (error) {
             
            console.error('Failed to resolve share code:', error);
            throw new Error('Invalid or corrupted share code');
        }
    }
}
