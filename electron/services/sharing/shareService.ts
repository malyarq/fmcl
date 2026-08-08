import { gzipSync, gunzipSync } from 'node:zlib';
import { ModpackManifest } from '@shared/types';
import type { LauncherRoot } from '../../domains/instances/instanceTypes';
import type { InstanceReadPort } from '../../domains/instances/ports';

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

const MAX_SHARE_COMPRESSED_BYTES = 32_768;
const MAX_SHARE_DECOMPRESSED_BYTES = 256 * 1024;
const MAX_SHARE_FILES = 1_000;
const MAX_NAME_LENGTH = 120;
const MAX_RUNTIME_LENGTH = 64;
const MAX_IDENTIFIER_LENGTH = 128;
const MAX_LOADER_VERSION_LENGTH = 120;
const SHARE_CODE_PREFIX = 'burrow://share/v1/';

type ShareManifestMod = Readonly<{
    source: 'curseforge' | 'modrinth';
    projectId: string;
    versionId: string;
}>;

/** Main-process manifest capability that never exposes an instance path. */
export interface ShareContentPort {
    resolveDefaultRoot(): Promise<LauncherRoot>;
    loadManifest(root: LauncherRoot, instanceId: string): Promise<Readonly<{
        mods: readonly ShareManifestMod[];
    }>>;
}

export class ShareService {
    constructor(
        private readonly instanceReadPort: InstanceReadPort,
        private readonly content: ShareContentPort,
    ) { }

    public async generateShareCode(modpackId: string): Promise<string> {
        try {
            const root = await this.content.resolveDefaultRoot();
            const controlPlane = await this.instanceReadPort.read(root);
            if (controlPlane.status !== 'ready') {
                throw new Error('Canonical instance state is not initialized');
            }

            const record = controlPlane.snapshot.records.find((candidate) => candidate.id === modpackId);
            if (!record) {
                throw new Error(`Canonical instance ${modpackId} was not found`);
            }

            const { config, summary } = record;
            if (
                config.runtime.minecraftVersion !== summary.minecraftVersion
                || config.runtime.modLoader?.type !== summary.modLoader?.type
                || config.runtime.modLoader?.version !== summary.modLoader?.version
            ) {
                throw new Error('Canonical instance configuration and summary disagree');
            }

            const instanceManifest = await this.content.loadManifest(root, record.id);

            const mini: MiniManifest = {
                v: 1,
                n: record.name,
                mc: config.runtime.minecraftVersion,
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

            return `burrow://share/v1/${base64}`;
        } catch (error) {
             
            console.error('Failed to generate share code:', error);
            throw new Error('Failed to generate share code');
        }
    }

    public async resolveShareCode(code: string): Promise<ModpackManifest> {
        try {
            const base64 = code.startsWith(SHARE_CODE_PREFIX) ? code.slice(SHARE_CODE_PREFIX.length) : code;

            const buffer = Buffer.from(base64, 'base64');
            if (buffer.length === 0 || buffer.length > MAX_SHARE_COMPRESSED_BYTES) {
                throw new Error('Share code payload is out of bounds');
            }
            const decompressed = gunzipSync(buffer, { maxOutputLength: MAX_SHARE_DECOMPRESSED_BYTES });
            const jsonString = decompressed.toString('utf-8');
            const mini = validateMiniManifest(JSON.parse(jsonString) as unknown);

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

function validateMiniManifest(value: unknown): MiniManifest {
    const record = exactRecord(value, ['v', 'n', 'mc', 'ml', 'f'], 'Share manifest');
    if (record.v !== 1) throw new Error('Unsupported share code version');
    if (!Array.isArray(record.f) || record.f.length > MAX_SHARE_FILES) throw new Error('Share manifest files are out of bounds');

    const loader = exactRecord(record.ml, ['t', 'v'], 'Share manifest loader');
    const type = boundedString(loader.t, 'Share manifest loader type', MAX_IDENTIFIER_LENGTH);
    if (!['vanilla', 'forge', 'fabric', 'quilt', 'neoforge'].includes(type)) throw new Error('Share manifest loader type is unsupported');

    return {
        v: 1,
        n: boundedString(record.n, 'Share manifest name', MAX_NAME_LENGTH),
        mc: boundedString(record.mc, 'Share manifest Minecraft version', MAX_RUNTIME_LENGTH),
        ml: {
            t: type,
            ...(loader.v === undefined ? {} : { v: boundedString(loader.v, 'Share manifest loader version', MAX_LOADER_VERSION_LENGTH) }),
        },
        f: record.f.map((file, index) => validateMiniManifestFile(file, index)),
    };
}

function validateMiniManifestFile(value: unknown, index: number): MiniManifestFile {
    const record = exactRecord(value, ['p', 'f', 'm', 'v'], `Share manifest file ${index}`);
    const hasCurseForge = record.p !== undefined || record.f !== undefined;
    const hasModrinth = record.m !== undefined || record.v !== undefined;
    if (hasCurseForge === hasModrinth) throw new Error(`Share manifest file ${index} must identify exactly one provider version`);

    if (hasCurseForge) {
        if (!isPositiveSafeInteger(record.p) || !isPositiveSafeInteger(record.f)) throw new Error(`Share manifest file ${index} has invalid CurseForge identifiers`);
        return { p: record.p, f: record.f };
    }

    return {
        m: boundedString(record.m, `Share manifest file ${index} Modrinth project`, MAX_IDENTIFIER_LENGTH),
        v: boundedString(record.v, `Share manifest file ${index} Modrinth version`, MAX_IDENTIFIER_LENGTH),
    };
}

function exactRecord(value: unknown, keys: readonly string[], label: string): Record<string, unknown> {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object`);
    const record = value as Record<string, unknown>;
    if (Object.keys(record).some((key) => !keys.includes(key))) throw new Error(`${label} has unsupported fields`);
    return record;
}

function boundedString(value: unknown, label: string, maxLength: number): string {
    if (typeof value !== 'string' || !value.trim() || value.length > maxLength) throw new Error(`${label} is invalid`);
    return value;
}

function isPositiveSafeInteger(value: unknown): value is number {
    return Number.isSafeInteger(value) && (value as number) > 0;
}
