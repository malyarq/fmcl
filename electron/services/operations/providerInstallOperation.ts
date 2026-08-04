import fs from 'node:fs';
import type { CurseforgeV1Client } from '@xmcl/curseforge';
import type { ModrinthV2Client } from '@xmcl/modrinth';
import { assertChildName, resolvePathWithinRoot } from '../../security/pathGuards';
import { getModpackDir, resolveLauncherRootPath } from '../instances/paths';
import {
  nodeProviderArchivePort,
  nodeProviderContentPort,
  nodeProviderDownloadPort,
  stageCurseForgeModpack,
  stageModrinthModpack,
  type ProviderStagedInstall,
} from '../modpacks/installers';
import { readCanonicalRecordFromContent } from './canonicalRecord';
import { StagingWorkspace } from './stagingWorkspace';
import type { InstanceCommand } from '../../domains/instances/instanceTypes';
import type { OperationAdapter, OperationContext, OperationInput, OperationResult } from './operationTypes';

export type ProviderStageInput = Readonly<{
  rootPath: string;
  destinationId: string;
  checkCancelled(): void;
}>;

export type ProviderStageResult = ProviderStagedInstall;

export type ProviderInstallers = Readonly<{
  curseforge(input: ProviderStageInput & Readonly<{ projectId: number; fileId: number }>): Promise<ProviderStageResult>;
  modrinth(input: ProviderStageInput & Readonly<{ projectId: string; versionId: string }>): Promise<ProviderStageResult>;
}>;

export type ProviderInstallOperationOptions = Readonly<{
  installers: ProviderInstallers;
  faults?: Partial<Record<'validation' | 'publish' | 'control-plane', () => void>>;
}>;

/** Live provider SDKs remain staging-only adapters; publication belongs to OperationRunner. */
export function createLiveProviderInstallers(
  providers: Readonly<{ curseforge(): CurseforgeV1Client | null; modrinth(): ModrinthV2Client }>,
): ProviderInstallers {
  return {
    curseforge: async ({ rootPath, destinationId, projectId, fileId, checkCancelled }) => {
      const provider = providers.curseforge();
      if (!provider) throw new Error('CurseForge API key is not configured');
      return await stageCurseForgeModpack({ provider, download: nodeProviderDownloadPort, archive: nodeProviderArchivePort, content: nodeProviderContentPort }, {
        projectId, fileId, destinationId, stagingRoot: rootPath, checkCancelled,
      });
    },
    modrinth: async ({ rootPath, destinationId, projectId, versionId, checkCancelled }) => await stageModrinthModpack({
      provider: providers.modrinth(), download: nodeProviderDownloadPort, archive: nodeProviderArchivePort, content: nodeProviderContentPort,
    }, { projectId, versionId, destinationId, stagingRoot: rootPath, checkCancelled }),
  };
}

export function createProviderInstallOperationAdapters(options: ProviderInstallOperationOptions): OperationAdapter[] {
  return [
    createProviderInstallOperationAdapter('install-curseforge', options),
    createProviderInstallOperationAdapter('install-modrinth', options),
  ];
}

function createProviderInstallOperationAdapter(kind: Extract<OperationInput['kind'], 'install-curseforge' | 'install-modrinth'>, options: ProviderInstallOperationOptions): OperationAdapter {
  return {
    kind,
    async run(context): Promise<OperationResult> {
      const input = context.snapshot.input;
      if (input.kind !== kind) throw new Error(`Provider adapter received an invalid ${kind} input`);
      const rootPath = resolveLauncherRootPath(input.rootPath);
      const destinationId = assertChildName(input.destinationId ?? defaultDestinationId(input), 'Provider destination modpack id');
      const destinationPath = getModpackDir(rootPath, destinationId);
      const workspace = new StagingWorkspace(rootPath, context.snapshot.id);
      let backupCreated = false;
      let published = false;

      context.setRecoveryData({ destinationId, destinationName: input.name?.trim() || destinationId, missing: [] });
      try {
        const stage = input.kind === 'install-curseforge'
          ? await options.installers.curseforge({ rootPath: workspace.stagingRoot, destinationId, projectId: input.projectId, fileId: input.fileId, checkCancelled: () => throwIfCancelled(context) })
          : await options.installers.modrinth({ rootPath: workspace.stagingRoot, destinationId, projectId: input.projectId, versionId: input.versionId, checkCancelled: () => throwIfCancelled(context) });
        throwIfCancelled(context);
        validateStageResult(stage, destinationId);
        context.setRecoveryData({ destinationId, destinationName: stage.config.name, missing: [...stage.missing] });
        workspace.markStaged(workspace.stagedModpack(destinationId));
        context.transition('staged', { completed: 1, total: 4, message: 'staged' });

        options.faults?.validation?.();
        throwIfCancelled(context);
        validateStagedProviderInstall(workspace.stagedModpack(destinationId), destinationId);
        const command = canonicalCommand(workspace.stagedModpack(destinationId), destinationId, stage);
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
        return stage.missing.length > 0 ? { status: 'degraded', instanceId: destinationId, missing: [...stage.missing] } : { status: 'succeeded', instanceId: destinationId };
      } catch (error) {
        if (backupCreated && !workspace.restoreDestination(destinationPath, destinationId)) return { status: 'recovery-required', message: 'Provider rollback destination is ambiguous' };
        if (published && !backupCreated && workspace.recoverUncommittedDestination(destinationPath, destinationId) === false) throw new Error('ROLLBACK_RECOVERY_REQUIRED');
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

function defaultDestinationId(input: Extract<OperationInput, { kind: 'install-curseforge' | 'install-modrinth' }>): string {
  const seed = input.kind === 'install-curseforge' ? `curseforge-${input.projectId}-${input.fileId}` : `modrinth-${input.projectId}-${input.versionId}`;
  return seed.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').slice(0, 80) || 'provider-install';
}

function validateStageResult(stage: ProviderStageResult, destinationId: string): void {
  if (stage.config.id !== destinationId || stage.content.instanceId !== destinationId) throw new Error('Provider installer returned an invalid staged instance');
  if (!['curseforge', 'modrinth'].includes(stage.source.source) || !stage.source.sourceId || !stage.source.sourceVersionId) throw new Error('Provider installer returned invalid source metadata');
}

function validateStagedProviderInstall(stagedPath: string, destinationId: string): void {
  const configPath = resolvePathWithinRoot(stagedPath, 'modpack.json', 'Staged provider install config');
  if (!fs.existsSync(configPath)) throw new Error('Staged provider install is missing modpack.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8')) as { id?: unknown; runtime?: { minecraft?: unknown } };
  if (config.id !== destinationId || typeof config.runtime?.minecraft !== 'string' || !config.runtime.minecraft) throw new Error('Staged provider install config is invalid');
}

function canonicalCommand(stagedPath: string, destinationId: string, stage: ProviderStageResult): InstanceCommand {
  const record = readCanonicalRecordFromContent(stagedPath, destinationId);
  return {
    version: 1,
    type: 'commit-published',
    record: { ...record, source: { ...stage.source, createdAt: record.source.createdAt, updatedAt: record.source.updatedAt } },
    select: true,
  };
}

async function commitControlPlane(context: OperationContext, command: InstanceCommand): Promise<void> {
  const result = await context.commitControlPlane(command);
  if ('code' in result) throw new Error(result.message);
}

function throwIfCancelled(context: OperationContext): void {
  if (context.isCancelled()) throw new Error('Operation cancelled');
}
