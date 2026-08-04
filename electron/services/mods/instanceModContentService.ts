import fs from 'node:fs';
import type { InstanceModRegistrationRequest } from '../../../shared/contracts/instanceMods';
import type { ModpackManifest } from '../../../shared/types/modpack';
import type { InstanceReadPort, LauncherRootResolver } from '../../domains/instances/ports';
import { assertChildName, resolvePathWithinRoot } from '../../security/pathGuards';
import { getModpackDir, resolveApprovedInstancePath, resolveLauncherRootPath } from '../instances/paths';
import { scanModsFolder } from './scanner';
import type { ModEntry } from './types';

/** Main-only content service scoped once to the composition-owned launcher root. */
export class InstanceModContentService {
  private readonly rootPath: string;

  constructor(
    rootPath: string,
    private readonly instances: InstanceReadPort,
    private readonly rootResolver: LauncherRootResolver,
  ) {
    this.rootPath = resolveLauncherRootPath(rootPath);
  }

  public async list(instanceId: string): Promise<ModEntry[]> {
    const modsDirectory = resolvePathWithinRoot(this.instancePath(instanceId), 'mods', 'Mods directory');
    return await scanModsFolder(modsDirectory);
  }

  public remove(instanceId: string, fileName: string): void {
    const safeFileName = assertChildName(fileName, 'Mod filename');
    const instancePath = this.instancePath(instanceId);
    const modPath = resolvePathWithinRoot(
      resolvePathWithinRoot(instancePath, 'mods', 'Mods directory'),
      safeFileName,
      'Mod file path',
    );
    fs.rmSync(modPath, { force: true });

    const manifest = this.readManifest(instancePath);
    if (!manifest) return;
    manifest.files = manifest.files.filter((entry) => entry.path !== safeFileName && entry.path !== `mods/${safeFileName}`);
    this.writeManifest(instancePath, manifest);
  }

  public setEnabled(instanceId: string, fileName: string, enabled: boolean): void {
    const safeFileName = assertChildName(fileName, 'Mod filename');
    const modsDirectory = resolvePathWithinRoot(this.instancePath(instanceId), 'mods', 'Mods directory');
    const sourcePath = resolvePathWithinRoot(modsDirectory, safeFileName, 'Mod file path');
    if (!fs.existsSync(sourcePath)) return;

    const targetName = enabled && safeFileName.endsWith('.jar.disabled')
      ? safeFileName.slice(0, -'.disabled'.length)
      : !enabled && safeFileName.endsWith('.jar')
        ? `${safeFileName}.disabled`
        : null;
    if (!targetName) return;

    const targetPath = resolvePathWithinRoot(
      modsDirectory,
      assertChildName(targetName, 'Toggled mod filename'),
      'Toggled mod file path',
    );
    if (fs.existsSync(targetPath)) throw new Error(`Mod file already exists: ${targetName}`);
    fs.renameSync(sourcePath, targetPath);
  }

  public async register(instanceId: string, registration: InstanceModRegistrationRequest): Promise<void> {
    const instancePath = this.instancePath(instanceId);
    const manifest = this.readManifest(instancePath) ?? await this.createManifestFromCanonical(instanceId);
    manifest.files = manifest.files.filter((entry) => registration.platform === 'curseforge'
      ? !(entry.projectID === Number(registration.projectId) && entry.fileID === Number(registration.versionId))
      : !(entry.projectId === registration.projectId && entry.versionId === registration.versionId));

    if (registration.platform === 'curseforge') {
      const projectID = Number(registration.projectId);
      const fileID = Number(registration.versionId);
      if (!Number.isSafeInteger(projectID) || !Number.isSafeInteger(fileID)) {
        throw new Error('CurseForge registration IDs must be safe integers');
      }
      manifest.files.push({ projectID, fileID, required: true });
    } else {
      manifest.files.push({
        projectId: registration.projectId,
        versionId: registration.versionId,
        required: true,
      });
    }

    this.writeManifest(instancePath, manifest);
  }

  private instancePath(instanceId: string): string {
    return resolveApprovedInstancePath(getModpackDir(this.rootPath, assertChildName(instanceId, 'Instance id')));
  }

  private readManifest(instancePath: string): ModpackManifest | null {
    const manifestPath = resolvePathWithinRoot(instancePath, 'manifest.json', 'Manifest path');
    if (!fs.existsSync(manifestPath)) return null;

    const value: unknown = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    if (!value || typeof value !== 'object' || !Array.isArray((value as { files?: unknown }).files)) {
      throw new Error('Instance manifest is invalid');
    }
    return value as ModpackManifest;
  }

  private async createManifestFromCanonical(instanceId: string): Promise<ModpackManifest> {
    const root = await this.rootResolver.resolve(this.rootPath);
    const state = await this.instances.read(root);
    const record = state.status === 'ready'
      ? state.snapshot.records.find((candidate) => candidate.id === instanceId)
      : undefined;
    if (!record) throw new Error(`Canonical instance does not exist: ${instanceId}`);
    const loader = record.config.runtime.modLoader;
    const loaderId = loader
      ? loader.version
        ? `${loader.type}-${loader.version}`
        : loader.type
      : null;
    return {
      formatVersion: 1,
      minecraft: {
        version: record.config.runtime.minecraftVersion,
        modLoaders: loaderId ? [{ id: loaderId, primary: true }] : [],
      },
      name: record.name,
      version: record.source.version ?? '1.0.0',
      ...(record.source.author ? { author: record.source.author } : {}),
      files: [],
    };
  }

  private writeManifest(instancePath: string, manifest: ModpackManifest): void {
    fs.mkdirSync(instancePath, { recursive: true });
    const manifestPath = resolvePathWithinRoot(instancePath, 'manifest.json', 'Manifest path');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), { encoding: 'utf8', mode: 0o600 });
  }
}
