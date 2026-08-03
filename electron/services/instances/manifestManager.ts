import path from 'node:path';
import { AtomicJsonStore } from '../storage/atomicJsonStore';

export interface InstalledMod {
    fileName: string;
    source: 'curseforge' | 'modrinth';
    projectId: string;
    versionId: string; // fileId for CF, versionId for MR
    sha1?: string;
    installDate: string;
}

export interface InstanceManifest {
    version: number;
    mods: InstalledMod[];
}

function isInstanceManifest(value: unknown): value is InstanceManifest {
    if (!value || typeof value !== 'object') return false;
    const candidate = value as Partial<InstanceManifest>;
    return candidate.version === 1 && Array.isArray(candidate.mods);
}

export class InstanceManifestManager {
    private getManifestPath(instancePath: string): string {
        return path.join(instancePath, 'instance-manifest.json');
    }

    private getStore(instancePath: string): AtomicJsonStore<InstanceManifest> {
        return new AtomicJsonStore(this.getManifestPath(instancePath), {
            version: 1,
            validate: isInstanceManifest,
        });
    }

    public loadManifest(instancePath: string): InstanceManifest {
        return this.getStore(instancePath).read()?.value ?? { version: 1, mods: [] };
    }

    public saveManifest(instancePath: string, manifest: InstanceManifest) {
        this.getStore(instancePath).write(manifest);
    }

    public addMod(instancePath: string, mod: InstalledMod) {
        const manifest = this.loadManifest(instancePath);
        // Remove existing entry for same file or same project
        manifest.mods = manifest.mods.filter(m =>
            m.fileName !== mod.fileName &&
            !(m.source === mod.source && m.projectId === mod.projectId)
        );
        manifest.mods.push(mod);
        this.saveManifest(instancePath, manifest);
    }

    public removeMod(instancePath: string, fileName: string) {
        const manifest = this.loadManifest(instancePath);
        manifest.mods = manifest.mods.filter(m => m.fileName !== fileName);
        this.saveManifest(instancePath, manifest);
    }
}
