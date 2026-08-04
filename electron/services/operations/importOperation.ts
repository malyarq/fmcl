import fs from 'node:fs';
import path from 'node:path';
import { assertChildName, resolvePathWithinRoot } from '../../security/pathGuards';
import { getModpackDir, resolveLauncherRootPath } from '../instances/paths';
import type { ModLoaderType, ModpackConfig } from '../instances/types';
import { stageArchiveImport } from '../modpacks/importers/localInstaller';
import { readCanonicalRecordFromContent } from './canonicalRecord';
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
      const destinationId = resolveDestinationId(input.destinationId, input.name, input.filePath, rootPath);
      const destinationPath = getModpackDir(rootPath, destinationId);
      const workspace = new StagingWorkspace(rootPath, context.snapshot.id);
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
        writeStagedConfig(workspace.stagedModpack(destinationId), config);
        workspace.markStaged(workspace.stagedModpack(destinationId));
        context.setRecoveryData({ destinationId, destinationName: config.name, missing });
        context.transition('staged', { completed: 1, total: 4, message: 'staged' });

        options.faults?.validation?.();
        throwIfCancelled(context);
        validateStagedImport(workspace.stagedModpack(destinationId), destinationId);
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
        return missing.length > 0 ? { status: 'degraded', instanceId: destinationId, missing } : { status: 'succeeded', instanceId: destinationId };
      } catch (error) {
        if (backupCreated && !workspace.restoreDestination(destinationPath, destinationId)) return { status: 'recovery-required', message: 'Import rollback destination is ambiguous' };
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

function resolveDestinationId(requestedId: string | undefined, requestedName: string | undefined, filePath: string, rootPath: string): string {
  if (requestedId) return assertChildName(requestedId, 'Destination modpack id');
  const baseName = requestedName?.trim() || path.basename(filePath, path.extname(filePath));
  const slug = baseName.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'imported-modpack';
  let destinationId = slug;
  for (let suffix = 2; fs.existsSync(getModpackDir(rootPath, destinationId)); suffix += 1) destinationId = `${slug}-${suffix}`;
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

async function commitControlPlane(context: OperationContext, command: Parameters<OperationContext['commitControlPlane']>[0]): Promise<void> {
  const result = await context.commitControlPlane(command);
  if ('code' in result) throw new Error(result.message);
}

function writeStagedConfig(instancePath: string, config: ModpackConfig): void {
  fs.writeFileSync(resolvePathWithinRoot(instancePath, 'modpack.json', 'Staged import config'), JSON.stringify(config));
}

function throwIfCancelled(context: OperationContext): void {
  if (context.isCancelled()) throw new Error('Operation cancelled');
}
