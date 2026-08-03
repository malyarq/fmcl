import fs from 'node:fs';
import { assertChildName, resolvePathWithinRoot } from '../../security/pathGuards';
import { loadModpackConfigFile } from '../instances/configStore';
import { loadModpacksIndexFile, saveModpacksIndexFile } from '../instances/indexStore';
import { getModpackConfigPath, getModpackDir, resolveLauncherRootPath } from '../instances/paths';
import { invalidateModpacksMetadataCache, loadModpacksMetadata, saveModpacksMetadata } from '../modpacks/storage';
import { StagingWorkspace } from './stagingWorkspace';
import type { OperationAdapter, OperationContext, OperationResult } from './operationTypes';

type DeleteFault = 'quarantine' | 'index' | 'metadata' | 'cleanup';

export type DeleteOperationOptions = {
  faults?: Partial<Record<DeleteFault, () => void>>;
  hooks?: {
    afterQuarantine?: () => void | Promise<void>;
  };
};

type FileSnapshot = { path: string; bytes?: Buffer };

export function createDeleteOperationAdapter(options: DeleteOperationOptions = {}): OperationAdapter {
  return {
    kind: 'delete',
    async run(context): Promise<OperationResult> {
      const input = context.snapshot.input;
      if (input.kind !== 'delete') throw new Error('Delete adapter received an invalid input');

      const rootPath = resolveLauncherRootPath(input.rootPath);
      const destinationId = assertChildName(input.instanceId, 'Deleted modpack id');
      const destinationPath = getModpackDir(rootPath, destinationId);
      validateLiveInstance(rootPath, destinationId, destinationPath);
      const controlPlaneBefore = snapshotControlPlane(rootPath);
      const workspace = new StagingWorkspace(rootPath, context.snapshot.id);
      let quarantined = false;

      context.setRecoveryData({ destinationId });
      try {
        throwIfCancelled(context);
        options.faults?.quarantine?.();
        context.setPublishIntent(destinationId, true, { completed: 0, total: 3, message: 'publish-intent' });
        quarantined = workspace.createBackup(destinationPath, destinationId);
        if (!quarantined) throw new Error(`Modpack ${destinationId} disappeared before quarantine`);
        context.transition('backup-created', { completed: 1, total: 3, message: 'quarantined' });
        context.transition('published', { completed: 1, total: 3, message: 'quarantined' });
        await options.hooks?.afterQuarantine?.();
        throwIfCancelled(context);

        commitControlPlane(rootPath, destinationId, options.faults);
        context.transition('control-plane-committed', { completed: 2, total: 3, message: 'control-plane-committed' });

        try {
          options.faults?.cleanup?.();
          workspace.cleanupBackups();
        } catch {
          return { status: 'recovery-required', message: 'Committed delete quarantine cleanup failed' };
        }
        return { status: 'succeeded', instanceId: destinationId };
      } catch (error) {
        if (quarantined && !workspace.restoreDestination(destinationPath, destinationId)) return { status: 'recovery-required', message: 'Delete rollback destination is ambiguous' };
        restoreControlPlane(controlPlaneBefore, rootPath);
        workspace.cleanupStaging();
        if (quarantined) workspace.cleanupBackups();
        throw error;
      }
    },
    async recoverPublished(context): Promise<OperationResult> {
      const recovery = context.snapshot.recovery;
      if (!recovery || !('destinationId' in recovery)) {
        return { status: 'recovery-required', message: 'Delete recovery data is missing' };
      }

      const rootPath = resolveLauncherRootPath(context.snapshot.rootPath);
      const destinationId = assertChildName(recovery.destinationId, 'Deleted modpack id');
      const destinationPath = getModpackDir(rootPath, destinationId);
      const workspace = new StagingWorkspace(rootPath, context.snapshot.id);
      const quarantinePath = workspace.backupModpack(destinationId);

      if (context.snapshot.phase === 'published') {
        if (!isPreCommitQuarantine(rootPath, destinationId, destinationPath, quarantinePath)) {
          return { status: 'recovery-required', message: 'Pre-commit delete quarantine is ambiguous' };
        }
        if (!workspace.restoreDestination(destinationPath, destinationId)) return { status: 'recovery-required', message: 'Delete recovery destination is ambiguous' };
        return { status: 'recovered', instanceId: destinationId };
      }

      if (context.snapshot.phase === 'control-plane-committed') {
        if (!isCommittedDelete(rootPath, destinationId, destinationPath, quarantinePath)) {
          return { status: 'recovery-required', message: 'Committed delete residue is ambiguous' };
        }
        try {
          workspace.cleanupBackups();
          return { status: 'recovered', instanceId: destinationId };
        } catch {
          return { status: 'recovery-required', message: 'Committed delete quarantine cleanup failed' };
        }
      }

      return { status: 'recovery-required', message: 'Delete recovery phase is unsupported' };
    },
  };
}

function validateLiveInstance(rootPath: string, destinationId: string, destinationPath: string): void {
  const index = loadModpacksIndexFile(rootPath);
  if (!index.modpacks[destinationId]) throw new Error(`Modpack ${destinationId} not found in the control plane`);
  const configPath = getModpackConfigPath(rootPath, destinationId);
  if (!fs.existsSync(destinationPath) || !fs.existsSync(configPath)) throw new Error(`Modpack ${destinationId} does not have a live directory and config`);
  if (loadModpackConfigFile(rootPath, destinationId).id !== destinationId) throw new Error(`Modpack ${destinationId} config does not match the control plane`);
}

function commitControlPlane(rootPath: string, destinationId: string, faults: DeleteOperationOptions['faults']): void {
  const index = loadModpacksIndexFile(rootPath);
  if (!index.modpacks[destinationId]) throw new Error(`Modpack ${destinationId} disappeared from the control plane`);
  delete index.modpacks[destinationId];
  if (index.selectedModpack === destinationId) index.selectedModpack = selectRemainingModpack(index.modpacks);
  faults?.index?.();
  saveModpacksIndexFile(rootPath, index);

  const metadata = loadModpacksMetadata(rootPath);
  delete metadata.modpacks[destinationId];
  if (metadata.selectedModpack === destinationId) metadata.selectedModpack = index.selectedModpack;
  faults?.metadata?.();
  saveModpacksMetadata(rootPath, metadata);
}

function selectRemainingModpack(modpacks: Record<string, { name: string }>): string {
  const remainingIds = Object.keys(modpacks);
  return remainingIds.length > 0 ? (modpacks.default ? 'default' : remainingIds[0]) : 'default';
}

function isPreCommitQuarantine(rootPath: string, destinationId: string, destinationPath: string, quarantinePath: string): boolean {
  return !fs.existsSync(destinationPath)
    && fs.existsSync(quarantinePath)
    && Boolean(loadModpacksIndexFile(rootPath).modpacks[destinationId]);
}

function isCommittedDelete(rootPath: string, destinationId: string, destinationPath: string, quarantinePath: string): boolean {
  if (fs.existsSync(destinationPath) || !fs.existsSync(quarantinePath)) return false;
  const index = loadModpacksIndexFile(rootPath);
  const metadata = loadModpacksMetadata(rootPath);
  return !index.modpacks[destinationId]
    && !metadata.modpacks[destinationId]
    && index.selectedModpack !== destinationId
    && metadata.selectedModpack !== destinationId;
}

function throwIfCancelled(context: OperationContext): void {
  if (context.isCancelled()) throw new Error('Operation cancelled');
}

function snapshotControlPlane(rootPath: string): FileSnapshot[] {
  return ['modpacks.json', 'modpacks-metadata.json'].map((name) => {
    const filePath = resolvePathWithinRoot(rootPath, name, 'Delete control-plane file');
    return { path: filePath, bytes: fs.existsSync(filePath) ? fs.readFileSync(filePath) : undefined };
  });
}

function restoreControlPlane(snapshots: FileSnapshot[], rootPath: string): void {
  for (const snapshot of snapshots) {
    if (snapshot.bytes) fs.writeFileSync(snapshot.path, snapshot.bytes);
    else fs.rmSync(snapshot.path, { force: true });
  }
  invalidateModpacksMetadataCache(rootPath);
}
