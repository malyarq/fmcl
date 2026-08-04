import fs from 'node:fs';
import { assertChildName } from '../../security/pathGuards';
import { getModpackDir, resolveLauncherRootPath } from '../instances/paths';
import { readCanonicalRecordFromContent } from './canonicalRecord';
import { StagingWorkspace } from './stagingWorkspace';
import type { OperationAdapter, OperationContext, OperationResult } from './operationTypes';

type DeleteFault = 'quarantine' | 'index' | 'metadata' | 'cleanup';

export type DeleteOperationOptions = {
  faults?: Partial<Record<DeleteFault, () => void>>;
  hooks?: {
    afterQuarantine?: () => void | Promise<void>;
  };
};

export function createDeleteOperationAdapter(options: DeleteOperationOptions = {}): OperationAdapter {
  return {
    kind: 'delete',
    async run(context): Promise<OperationResult> {
      const input = context.snapshot.input;
      if (input.kind !== 'delete') throw new Error('Delete adapter received an invalid input');

      const rootPath = resolveLauncherRootPath(input.rootPath);
      const destinationId = assertChildName(input.instanceId, 'Deleted modpack id');
      const destinationPath = getModpackDir(rootPath, destinationId);
      validateLiveInstance(destinationId, destinationPath);
      const workspace = new StagingWorkspace(rootPath, context.snapshot.id);
      let quarantined = false;

      context.setRecoveryData({ destinationId });
      const command = { version: 1 as const, type: 'delete' as const, id: destinationId };
      context.recordCanonicalCommand(command);
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

        await commitControlPlane(context, command, options.faults);
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
        workspace.cleanupStaging();
        if (quarantined) workspace.cleanupBackups();
        throw error;
      }
    },
    async recoverPublished(context): Promise<OperationResult> {
      return await context.replayCanonicalCommand();
    },
  };
}

function validateLiveInstance(destinationId: string, destinationPath: string): void {
  if (!fs.existsSync(destinationPath)) throw new Error(`Modpack ${destinationId} does not have a live directory`);
  readCanonicalRecordFromContent(destinationPath, destinationId);
}

async function commitControlPlane(
  context: OperationContext,
  command: Parameters<OperationContext['commitControlPlane']>[0],
  faults: DeleteOperationOptions['faults'],
): Promise<void> {
  faults?.index?.();
  faults?.metadata?.();
  const result = await context.commitControlPlane(command);
  if ('code' in result) throw new Error(result.message);
}

function throwIfCancelled(context: OperationContext): void {
  if (context.isCancelled()) throw new Error('Operation cancelled');
}
