import fs from 'node:fs';
import path from 'node:path';
import { assertChildName, resolvePathWithinRoot } from '../../security/pathGuards';
import { loadModpackConfigFile, saveModpackConfigFile } from '../instances/configStore';
import { loadModpacksIndexFile, saveModpacksIndexFile } from '../instances/indexStore';
import { getModpackDir } from '../instances/paths';
import { duplicateModpackMetadata } from '../modpacks/storage';
import { StagingWorkspace } from './stagingWorkspace';
import type { OperationAdapter, OperationContext, OperationResult } from './operationTypes';

type DuplicateFault = 'copy' | 'validation' | 'publish' | 'control-plane';

export type DuplicateOperationOptions = {
  faults?: Partial<Record<DuplicateFault, () => void>>;
};

export function createDuplicateOperationAdapter(options: DuplicateOperationOptions = {}): OperationAdapter {
  return {
    kind: 'duplicate',
    async run(context): Promise<OperationResult> {
      const input = context.snapshot.input;
      if (input.kind !== 'duplicate') throw new Error('Duplicate adapter received an invalid input');
      const rootPath = path.resolve(input.rootPath);
      const sourceId = assertChildName(input.sourceId, 'Source modpack id');
      const index = loadModpacksIndexFile(rootPath);
      if (!index.modpacks[sourceId]) throw new Error(`Modpack ${sourceId} not found`);
      const sourceConfig = loadModpackConfigFile(rootPath, sourceId);
      const destinationName = (input.name?.trim() || `${sourceConfig.name} Copy`).trim();
      const destinationId = resolveDestinationId(input.destinationId, destinationName, index.modpacks);
      const sourcePath = getModpackDir(rootPath, sourceId);
      const destinationPath = getModpackDir(rootPath, destinationId);
      const workspace = new StagingWorkspace(rootPath, context.snapshot.id);
      const controlPlaneBefore = snapshotControlPlane(rootPath);
      let published = false;
      let backupCreated = false;

      context.setRecoveryData({ sourceId, destinationId, destinationName });
      try {
        options.faults?.copy?.();
        workspace.stageCopy(sourcePath, destinationId);
        const copiedConfig = {
          ...sourceConfig,
          id: destinationId,
          name: destinationName,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        saveModpackConfigFile(workspace.stagingRoot, copiedConfig);
        context.transition('staged', { completed: 1, total: 4, message: 'staged' });

        options.faults?.validation?.();
        throwIfCancelled(context);
        validateStagedDuplicate(workspace.stagedModpack(destinationId), destinationId);
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
        commitControlPlane(rootPath, sourceId, destinationId, destinationName);
        context.transition('control-plane-committed', { completed: 4, total: 4, message: 'control-plane-committed' });
        workspace.removePublishMarker(destinationPath);
        workspace.cleanupStaging();
        workspace.cleanupBackups();
        return { status: 'succeeded', instanceId: destinationId };
      } catch (error) {
        if (backupCreated && !workspace.restoreDestination(destinationPath, destinationId)) return { status: 'recovery-required', message: 'Duplicate rollback destination is ambiguous' };
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
      if (!recovery || !('sourceId' in recovery)) return { status: 'recovery-required', message: 'Duplicate recovery data is missing' };
      const destinationPath = getModpackDir(context.snapshot.rootPath, recovery.destinationId);
      if (!isValidPublishedDuplicate(destinationPath, recovery.destinationId)) {
        return { status: 'recovery-required', message: 'Published duplicate cannot be verified' };
      }
      try {
        commitControlPlane(context.snapshot.rootPath, recovery.sourceId, recovery.destinationId, recovery.destinationName);
        context.transition('control-plane-committed', { completed: 4, total: 4, message: 'recovered-control-plane' });
        return { status: 'recovered', instanceId: recovery.destinationId };
      } catch {
        return { status: 'recovery-required', message: 'Published duplicate control-plane state is ambiguous' };
      }
    },
  };
}

function resolveDestinationId(requestedId: string | undefined, destinationName: string, entries: Record<string, { name: string }>): string {
  if (requestedId) return assertChildName(requestedId, 'Destination modpack id');
  const slug = destinationName.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'modpack-copy';
  let destinationId = slug;
  for (let suffix = 2; entries[destinationId]; suffix += 1) destinationId = `${slug}-${suffix}`;
  return destinationId;
}

function validateStagedDuplicate(stagedPath: string, destinationId: string): void {
  const configPath = resolvePathWithinRoot(stagedPath, 'modpack.json', 'Staged modpack config');
  if (!fs.existsSync(configPath)) throw new Error('Staged duplicate is missing modpack.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8')) as { id?: unknown };
  if (config.id !== destinationId) throw new Error('Staged duplicate config id does not match destination');
}

function isValidPublishedDuplicate(destinationPath: string, destinationId: string): boolean {
  try {
    validateStagedDuplicate(destinationPath, destinationId);
    return true;
  } catch {
    return false;
  }
}

function commitControlPlane(rootPath: string, sourceId: string, destinationId: string, destinationName: string): void {
  const index = loadModpacksIndexFile(rootPath);
  index.modpacks[destinationId] = { name: destinationName };
  index.selectedModpack = destinationId;
  saveModpacksIndexFile(rootPath, index);
  duplicateModpackMetadata(rootPath, sourceId, loadModpackConfigFile(rootPath, destinationId));
}

function throwIfCancelled(context: OperationContext): void {
  if (context.isCancelled()) throw new Error('Operation cancelled');
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
