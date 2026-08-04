import fs from 'node:fs';
import { assertChildName, resolvePathWithinRoot } from '../../security/pathGuards';
import { assertPublicHttpsUrl } from '../../security/remoteUrls';
import { getModpackDir, resolveLauncherRootPath } from '../instances/paths';
import { Updater } from '../updater/instanceUpdater';
import { readCanonicalRecordFromContent } from './canonicalRecord';
import { StagingWorkspace } from './stagingWorkspace';
import type { OperationAdapter, OperationContext, OperationResult } from './operationTypes';

type UpdateFault = 'validation' | 'publish' | 'control-plane';

export type UpdateOperationOptions = {
  faults?: Partial<Record<UpdateFault, () => void>>;
  sync?: (input: { manifestUrl: string; stagePath: string; checkCancelled(): void }) => Promise<void>;
};

export function createUpdateOperationAdapter(options: UpdateOperationOptions = {}): OperationAdapter {
  return {
    kind: 'update',
    async run(context): Promise<OperationResult> {
      const input = context.snapshot.input;
      if (input.kind !== 'update') throw new Error('Update adapter received an invalid input');

      const rootPath = resolveLauncherRootPath(input.rootPath);
      const destinationId = assertChildName(input.instanceId, 'Updated modpack id');
      const manifestUrl = assertPublicHttpsUrl(input.manifestUrl, 'Updater manifest URL');
      const destinationPath = getModpackDir(rootPath, destinationId);
      if (!fs.existsSync(destinationPath)) throw new Error(`Modpack ${destinationId} not found`);

      const workspace = new StagingWorkspace(rootPath, context.snapshot.id);
      let backupCreated = false;
      context.setRecoveryData({ destinationId });

      try {
        workspace.stageCopy(destinationPath, destinationId);
        const stagePath = workspace.stagedModpack(destinationId);
        const checkCancelled = () => throwIfCancelled(context);
        if (options.sync) {
          await options.sync({ manifestUrl, stagePath, checkCancelled });
        } else {
          await new Updater(stagePath).sync(manifestUrl, () => undefined, { checkCancelled });
        }
        checkCancelled();
        context.transition('staged', { completed: 1, total: 4, message: 'staged' });

        options.faults?.validation?.();
        checkCancelled();
        validateStagedUpdate(stagePath, destinationId);
        const command = { version: 1 as const, type: 'reconcile-update' as const, record: readCanonicalRecordFromContent(stagePath, destinationId) };
        context.recordCanonicalCommand(command);
        context.transition('validated', { completed: 2, total: 4, message: 'validated' });
        checkCancelled();

        options.faults?.publish?.();
        context.setPublishIntent(destinationId, true, { completed: 2, total: 4, message: 'publish-intent' });
        backupCreated = workspace.createBackup(destinationPath, destinationId);
        if (backupCreated) context.transition('backup-created', { completed: 2, total: 4, message: 'backup-created' });
        workspace.publish(destinationPath, destinationId);
        context.transition('published', { completed: 3, total: 4, message: 'published' });

        options.faults?.['control-plane']?.();
        await commitControlPlane(context, command);
        context.transition('control-plane-committed', { completed: 4, total: 4, message: 'control-plane-committed' });
        workspace.removePublishMarker(destinationPath);
        workspace.cleanupStaging();
        workspace.cleanupBackups();
        return { status: 'succeeded', instanceId: destinationId };
      } catch (error) {
        if (backupCreated && !workspace.restoreDestination(destinationPath, destinationId)) return { status: 'recovery-required', message: 'Update rollback destination is ambiguous' };
        workspace.cleanupStaging();
        if (backupCreated) workspace.cleanupBackups();
        throw error;
      }
    },
    async recoverPublished(context): Promise<OperationResult> {
      return await context.replayCanonicalCommand();
    },
  };
}

function validateStagedUpdate(stagedPath: string, destinationId: string): void {
  const configPath = resolvePathWithinRoot(stagedPath, 'modpack.json', 'Staged update config');
  if (!fs.existsSync(configPath)) throw new Error('Staged update is missing modpack.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8')) as { id?: unknown; runtime?: { minecraft?: unknown } };
  if (config.id !== destinationId || typeof config.runtime?.minecraft !== 'string' || !config.runtime.minecraft) {
    throw new Error('Staged update config is invalid');
  }
}

async function commitControlPlane(context: OperationContext, command: Parameters<OperationContext['commitControlPlane']>[0]): Promise<void> {
  const result = await context.commitControlPlane(command);
  if ('code' in result) throw new Error(result.message);
}

function throwIfCancelled(context: OperationContext): void {
  if (context.isCancelled()) throw new Error('Operation cancelled');
}
