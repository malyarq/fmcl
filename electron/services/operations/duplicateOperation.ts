import fs from 'node:fs';
import path from 'node:path';
import { assertChildName, resolvePathWithinRoot } from '../../security/pathGuards';
import { getModpackDir } from '../instances/paths';
import { readCanonicalRecordFromContent } from './canonicalRecord';
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
      const sourcePath = getModpackDir(rootPath, sourceId);
      if (!fs.existsSync(sourcePath)) throw new Error(`Modpack ${sourceId} not found`);
      const sourceConfig = readStagedConfig(sourcePath, sourceId);
      const destinationName = (input.name?.trim() || `${sourceConfig.name} Copy`).trim();
      const destinationId = resolveDestinationId(input.destinationId, destinationName, rootPath);
      const destinationPath = getModpackDir(rootPath, destinationId);
      const workspace = new StagingWorkspace(rootPath, context.snapshot.id);
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
        writeStagedConfig(workspace.stagedModpack(destinationId), copiedConfig);
        context.transition('staged', { completed: 1, total: 4, message: 'staged' });

        options.faults?.validation?.();
        throwIfCancelled(context);
        validateStagedDuplicate(workspace.stagedModpack(destinationId), destinationId);
        const command = { version: 1 as const, type: 'commit-published' as const, record: readCanonicalRecordFromContent(workspace.stagedModpack(destinationId), destinationId), select: true };
        context.recordCanonicalCommand(command);
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
        await commitControlPlane(context, command);
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

function resolveDestinationId(requestedId: string | undefined, destinationName: string, rootPath: string): string {
  if (requestedId) return assertChildName(requestedId, 'Destination modpack id');
  const slug = destinationName.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'modpack-copy';
  let destinationId = slug;
  for (let suffix = 2; fs.existsSync(getModpackDir(rootPath, destinationId)); suffix += 1) destinationId = `${slug}-${suffix}`;
  return destinationId;
}

function validateStagedDuplicate(stagedPath: string, destinationId: string): void {
  const configPath = resolvePathWithinRoot(stagedPath, 'modpack.json', 'Staged modpack config');
  if (!fs.existsSync(configPath)) throw new Error('Staged duplicate is missing modpack.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8')) as { id?: unknown };
  if (config.id !== destinationId) throw new Error('Staged duplicate config id does not match destination');
}

async function commitControlPlane(context: OperationContext, command: Parameters<OperationContext['commitControlPlane']>[0]): Promise<void> {
  const result = await context.commitControlPlane(command);
  if ('code' in result) throw new Error(result.message);
}

function throwIfCancelled(context: OperationContext): void {
  if (context.isCancelled()) throw new Error('Operation cancelled');
}

function readStagedConfig(instancePath: string, expectedId: string): Record<string, unknown> {
  const configPath = resolvePathWithinRoot(instancePath, 'modpack.json', 'Source modpack config');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8')) as unknown;
  if (config === null || typeof config !== 'object' || Array.isArray(config)) throw new Error('Source modpack config is invalid');
  const value = config as Record<string, unknown>;
  if (value.id !== expectedId || typeof value.name !== 'string' || !value.name.trim()) throw new Error('Source modpack config is invalid');
  return value;
}

function writeStagedConfig(instancePath: string, config: Record<string, unknown>): void {
  fs.writeFileSync(resolvePathWithinRoot(instancePath, 'modpack.json', 'Staged modpack config'), JSON.stringify(config));
}
