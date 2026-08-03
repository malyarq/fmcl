import fs from 'node:fs';
import path from 'node:path';
import { assertChildName, resolvePathWithinRoot } from '../../security/pathGuards';
import { saveModpackConfigFile, loadModpackConfigFile } from '../instances/configStore';
import { loadModpacksIndexFile, saveModpacksIndexFile } from '../instances/indexStore';
import { getModpackDir, resolveLauncherRootPath } from '../instances/paths';
import type { ModLoaderType, ModpackConfig } from '../instances/types';
import { createModpackMetadataFromConfig, loadModpacksMetadata, saveModpacksMetadata } from '../modpacks/storage';
import { stageArchiveImport } from '../modpacks/importers/localInstaller';
import { StagingWorkspace } from './stagingWorkspace';
import type { OperationAdapter, OperationContext, OperationResult } from './operationTypes';

type ImportFault = 'extraction' | 'validation' | 'publish' | 'control-plane';

export type ImportOperationOptions = {
  faults?: Partial<Record<ImportFault, () => void>>;
};

export function createImportOperationAdapter(options: ImportOperationOptions = {}): OperationAdapter {
  return {
    kind: 'import',
    async run(context): Promise<OperationResult> {
      const input = context.snapshot.input;
      if (input.kind !== 'import') throw new Error('Import adapter received an invalid input');
      const rootPath = resolveLauncherRootPath(input.rootPath);
      const destinationId = resolveDestinationId(input.destinationId, input.name, input.filePath, loadModpacksIndexFile(rootPath).modpacks);
      const destinationPath = getModpackDir(rootPath, destinationId);
      const workspace = new StagingWorkspace(rootPath, context.snapshot.id);
      const controlPlaneBefore = snapshotControlPlane(rootPath);
      let backupCreated = false;
      let published = false;
      let missing: string[] = [];

      context.setRecoveryData({ destinationId, destinationName: input.name?.trim() || path.basename(input.filePath, path.extname(input.filePath)), missing });
      try {
        options.faults?.extraction?.();
        throwIfCancelled(context);
        const staged = await stageArchiveImport(input.filePath, workspace.stagedModpack(destinationId));
        missing = staged.missing;
        const config = buildConfig(destinationId, input.name?.trim() || staged.manifest.name, staged.manifest.minecraft.version, staged.manifest.minecraft.modLoaders[0]?.id);
        saveModpackConfigFile(workspace.stagingRoot, config);
        workspace.markStaged(workspace.stagedModpack(destinationId));
        context.setRecoveryData({ destinationId, destinationName: config.name, missing });
        context.transition('staged', { completed: 1, total: 4, message: 'staged' });

        options.faults?.validation?.();
        throwIfCancelled(context);
        validateStagedImport(workspace.stagedModpack(destinationId), destinationId);
        context.transition('validated', { completed: 2, total: 4, message: 'validated' });
        throwIfCancelled(context);

        options.faults?.publish?.();
        context.setPublishIntent(destinationId, fs.existsSync(destinationPath), { completed: 2, total: 4, message: 'publish-intent' });
        backupCreated = workspace.createBackup(destinationPath, destinationId);
        if (backupCreated) context.transition('backup-created', { completed: 2, total: 4, message: 'backup-created' });
        workspace.publish(destinationPath, destinationId);
        published = true;
        context.transition('published', { completed: 3, total: 4, message: 'published' });

        options.faults?.['control-plane']?.();
        commitControlPlane(rootPath, destinationId);
        context.transition('control-plane-committed', { completed: 4, total: 4, message: 'control-plane-committed' });
        workspace.removePublishMarker(destinationPath);
        workspace.cleanupStaging();
        workspace.cleanupBackups();
        return missing.length > 0 ? { status: 'degraded', instanceId: destinationId, missing } : { status: 'succeeded', instanceId: destinationId };
      } catch (error) {
        if (backupCreated && !workspace.restoreDestination(destinationPath, destinationId)) return { status: 'recovery-required', message: 'Import rollback destination is ambiguous' };
        if (published && !backupCreated && workspace.recoverUncommittedDestination(destinationPath, destinationId) === false) {
          throw new Error('ROLLBACK_RECOVERY_REQUIRED');
        }
        if (published) restoreControlPlane(controlPlaneBefore);
        workspace.cleanupStaging();
        if (backupCreated) workspace.cleanupBackups();
        throw error;
      }
    },
    async recoverPublished(context): Promise<OperationResult> {
      const recovery = context.snapshot.recovery;
      if (!recovery || !('missing' in recovery)) return { status: 'recovery-required', message: 'Import recovery data is missing' };
      const destinationPath = getModpackDir(context.snapshot.rootPath, recovery.destinationId);
      if (!isValidStagedImport(destinationPath, recovery.destinationId)) {
        return { status: 'recovery-required', message: 'Published import cannot be verified' };
      }
      try {
        commitControlPlane(context.snapshot.rootPath, recovery.destinationId);
        context.transition('control-plane-committed', { completed: 4, total: 4, message: 'recovered-control-plane' });
        return recovery.missing.length > 0 ? { status: 'degraded', instanceId: recovery.destinationId, missing: recovery.missing } : { status: 'recovered', instanceId: recovery.destinationId };
      } catch {
        return { status: 'recovery-required', message: 'Published import control-plane state is ambiguous' };
      }
    },
  };
}

function resolveDestinationId(requestedId: string | undefined, requestedName: string | undefined, filePath: string, entries: Record<string, { name: string }>): string {
  if (requestedId) return assertChildName(requestedId, 'Destination modpack id');
  const baseName = requestedName?.trim() || path.basename(filePath, path.extname(filePath));
  const slug = baseName.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'imported-modpack';
  let destinationId = slug;
  for (let suffix = 2; entries[destinationId]; suffix += 1) destinationId = `${slug}-${suffix}`;
  return destinationId;
}

function buildConfig(id: string, name: string, minecraft: string, loaderId?: string): ModpackConfig {
  const now = new Date().toISOString();
  return {
    id,
    name: name.trim() || id,
    runtime: { minecraft: minecraft || '1.20.1', modLoader: parseLoader(loaderId) },
    memory: { maxMb: 4096 },
    vmOptions: [],
    createdAt: now,
    updatedAt: now,
  };
}

function parseLoader(loaderId?: string): { type: ModLoaderType; version?: string } | undefined {
  if (!loaderId) return { type: 'vanilla' };
  const match = /^(forge|fabric|quilt|neoforge)(?:-(.+))?$/i.exec(loaderId);
  return match ? { type: match[1].toLowerCase() as ModLoaderType, version: match[2] } : { type: 'vanilla' };
}

function validateStagedImport(stagedPath: string, destinationId: string): void {
  const configPath = resolvePathWithinRoot(stagedPath, 'modpack.json', 'Staged import config');
  if (!fs.existsSync(configPath)) throw new Error('Staged import is missing modpack.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8')) as { id?: unknown; runtime?: { minecraft?: unknown } };
  if (config.id !== destinationId || typeof config.runtime?.minecraft !== 'string' || !config.runtime.minecraft) {
    throw new Error('Staged import config is invalid');
  }
}

function isValidStagedImport(destinationPath: string, destinationId: string): boolean {
  try {
    validateStagedImport(destinationPath, destinationId);
    return true;
  } catch {
    return false;
  }
}

function commitControlPlane(rootPath: string, destinationId: string): void {
  const config = loadModpackConfigFile(rootPath, destinationId);
  const index = loadModpacksIndexFile(rootPath);
  index.modpacks[destinationId] = { name: config.name };
  index.selectedModpack = destinationId;
  saveModpacksIndexFile(rootPath, index);
  const metadata = loadModpacksMetadata(rootPath);
  metadata.modpacks[destinationId] = createModpackMetadataFromConfig(config);
  metadata.selectedModpack = destinationId;
  saveModpacksMetadata(rootPath, metadata);
}

type FileSnapshot = { path: string; bytes?: Buffer };

function snapshotControlPlane(rootPath: string): FileSnapshot[] {
  return ['modpacks.json', 'modpacks-metadata.json'].map((name) => {
    const filePath = resolvePathWithinRoot(rootPath, name, 'Operation control-plane file');
    return { path: filePath, bytes: fs.existsSync(filePath) ? fs.readFileSync(filePath) : undefined };
  });
}

function restoreControlPlane(snapshots: FileSnapshot[]): void {
  for (const snapshot of snapshots) {
    if (snapshot.bytes) fs.writeFileSync(snapshot.path, snapshot.bytes);
    else fs.rmSync(snapshot.path, { force: true });
  }
}

function throwIfCancelled(context: OperationContext): void {
  if (context.isCancelled()) throw new Error('Operation cancelled');
}
