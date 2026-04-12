import fs from 'node:fs';
import path from 'node:path';

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

export class InstanceManifestManager {
    private getManifestPath(instancePath: string): string {
        return path.join(instancePath, 'instance-manifest.json');
    }

    public loadManifest(instancePath: string): InstanceManifest {
        const p = this.getManifestPath(instancePath);
        if (!fs.existsSync(p)) {
            return { version: 1, mods: [] };
        }
        try {
            return JSON.parse(fs.readFileSync(p, 'utf-8'));
        } catch (e) {
            console.error('Failed to parse instance-manifest.json', e);
            return { version: 1, mods: [] };
        }
    }

    public saveManifest(instancePath: string, manifest: InstanceManifest) {
        const p = this.getManifestPath(instancePath);
        fs.writeFileSync(p, JSON.stringify(manifest, null, 2));
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
