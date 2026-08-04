import fs from 'node:fs';
import type { ModpackManifest } from '../../../shared/types';
import { assertChildName, resolvePathWithinRoot } from '../../security/pathGuards';
import { getModpackDir } from '../instances/paths';
import { readCanonicalRecordFromContent } from './canonicalRecord';
import { StagingWorkspace } from './stagingWorkspace';
import type { OperationAdapter, OperationContext, OperationMissingItem, OperationResult, ShareImportOperationInput } from './operationTypes';

export type ShareManifestInstaller = Readonly<{
  resolveShareCode(code: string): Promise<ModpackManifest>;
  stageManifest(rootPath: string, destinationId: string, manifest: ModpackManifest): Promise<readonly ShareManifestInstallFailure[]>;
}>;

export type ShareManifestInstallFailure = Readonly<{
  index: number;
  reason: string;
}>;

/** Stages resolved share content before the common publish/control-plane transaction. */
export function createShareImportOperationAdapter(installer: ShareManifestInstaller): OperationAdapter {
  return {
    kind: 'import-share',
    async run(context: OperationContext): Promise<OperationResult> {
      const input = context.snapshot.input as ShareImportOperationInput;
      throwIfCancelled(context);
      const manifest = await installer.resolveShareCode(input.shareCode);
      throwIfCancelled(context);
      const destinationId = allocateId(input.rootPath, manifest.name);
      const destinationPath = getModpackDir(input.rootPath, destinationId);
      const workspace = new StagingWorkspace(input.rootPath, context.snapshot.id);
      const stagedPath = workspace.stagedModpack(destinationId);
      let backupCreated = false;
      let published = false;
      let missing: OperationMissingItem[] = [];
      context.setRecoveryData({ destinationId, destinationName: manifest.name.trim() || destinationId, missing: [] });
      try {
        fs.mkdirSync(stagedPath, { recursive: true });
        writeStagedConfig(stagedPath, destinationId, manifest);
        const installFailures = await installer.stageManifest(workspace.stagingRoot, destinationId, manifest);
        throwIfCancelled(context);
        missing = installFailures.map((failure) => toMissingItem(manifest, failure));
        const requiredFailures = installFailures.filter((failure) => manifest.files[failure.index]?.required !== false);
        if (requiredFailures.length > 0) throw new Error('Required share content could not be staged');
        context.setRecoveryData({ destinationId, destinationName: manifest.name.trim() || destinationId, missing });
        workspace.markStaged(stagedPath);
        context.transition('staged', { completed: 1, total: 4, message: 'staged' });
        validateStaged(stagedPath, destinationId);
        const command = { version: 1 as const, type: 'commit-published' as const, record: readCanonicalRecordFromContent(stagedPath, destinationId), select: true };
        context.recordCanonicalCommand(command);
        context.transition('validated', { completed: 2, total: 4, message: 'validated' });
        throwIfCancelled(context);
        context.setPublishIntent(destinationId, fs.existsSync(destinationPath), { completed: 2, total: 4, message: 'publish-intent' });
        backupCreated = workspace.createBackup(destinationPath, destinationId);
        if (backupCreated) context.transition('backup-created', { completed: 2, total: 4, message: 'backup-created' });
        workspace.publish(destinationPath, destinationId);
        published = true;
        context.transition('published', { completed: 3, total: 4, message: 'published' });
        const committed = await context.commitControlPlane(command);
        if ('code' in committed) throw new Error(committed.message);
        context.transition('control-plane-committed', { completed: 4, total: 4, message: 'control-plane-committed' });
        workspace.removePublishMarker(destinationPath);
        workspace.cleanupStaging();
        workspace.cleanupBackups();
        return missing.length > 0
          ? { status: 'degraded', instanceId: destinationId, missing }
          : { status: 'succeeded', instanceId: destinationId };
      } catch (error) {
        if (backupCreated && !workspace.restoreDestination(destinationPath, destinationId)) return { status: 'recovery-required', message: 'Share import rollback destination is ambiguous' };
        if (published && !backupCreated && workspace.recoverUncommittedDestination(destinationPath, destinationId) === false) return { status: 'recovery-required', message: 'Share import rollback requires recovery' };
        workspace.cleanupStaging();
        if (backupCreated) workspace.cleanupBackups();
        throw error;
      }
    },
    async recoverPublished(context): Promise<OperationResult> { return await context.replayCanonicalCommand(); },
  };
}

function throwIfCancelled(context: OperationContext): void {
  if (context.isCancelled()) throw new Error('Operation cancelled');
}

function toMissingItem(manifest: ModpackManifest, failure: ShareManifestInstallFailure): { path: string; reason: string } {
  const file = manifest.files[failure.index];
  if (!file) return { path: `manifest-file-${failure.index + 1}`, reason: failure.reason };
  if (file.projectID !== undefined && file.fileID !== undefined) return { path: `curseforge-${file.projectID}-${file.fileID}`, reason: failure.reason };
  if (file.projectId !== undefined && file.versionId !== undefined) return { path: `modrinth-${file.projectId}-${file.versionId}`, reason: failure.reason };
  return { path: `manifest-file-${failure.index + 1}`, reason: failure.reason };
}

function allocateId(rootPath: string, name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'shared-modpack';
  for (let suffix = 1; ; suffix += 1) {
    const id = suffix === 1 ? slug : `${slug}-${suffix}`;
    if (!fs.existsSync(getModpackDir(rootPath, id))) return assertChildName(id, 'Share destination id');
  }
}

function writeStagedConfig(stagedPath: string, id: string, manifest: ModpackManifest): void {
  const loader = manifest.minecraft.modLoaders[0]?.id;
  const match = /^(forge|fabric|quilt|neoforge)(?:-(.+))?$/i.exec(loader ?? '');
  const config = { id, name: manifest.name.trim() || id, runtime: { minecraft: manifest.minecraft.version, modLoader: match ? { type: match[1].toLowerCase(), version: match[2] } : { type: 'vanilla' } }, memory: { maxMb: 4096 }, vmOptions: [] };
  fs.writeFileSync(resolvePathWithinRoot(stagedPath, 'modpack.json', 'Staged share config'), JSON.stringify(config));
}

function validateStaged(stagedPath: string, id: string): void {
  const config = JSON.parse(fs.readFileSync(resolvePathWithinRoot(stagedPath, 'modpack.json', 'Staged share config'), 'utf8')) as { id?: unknown; runtime?: { minecraft?: unknown } };
  if (config.id !== id || typeof config.runtime?.minecraft !== 'string' || !config.runtime.minecraft) throw new Error('Staged share import config is invalid');
}
