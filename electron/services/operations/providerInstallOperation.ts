import fs from 'node:fs';
import { assertChildName, resolvePathWithinRoot } from '../../security/pathGuards';
import { loadModpackConfigFile } from '../instances/configStore';
import { loadModpacksIndexFile, saveModpacksIndexFile } from '../instances/indexStore';
import { getModpackDir, resolveLauncherRootPath } from '../instances/paths';
import type { ModpackConfig } from '../instances/types';
import { createModpackMetadataFromConfig, loadModpacksMetadata, saveModpacksMetadata } from '../modpacks/storage';
import type { ModpackMetadata } from '../../../shared/types/modpack';
import type { CurseforgeV1Client } from '@xmcl/curseforge';
import type { ModrinthV2Client } from '@xmcl/modrinth';
import { downloadCurseForgeModpack } from '../modpacks/installers/curseforgeInstaller';
import { downloadModrinthModpack } from '../modpacks/installers/modrinthInstaller';
import type { ModpackService } from '../modpacks/modpackService';
import { StagingWorkspace } from './stagingWorkspace';
import type { OperationAdapter, OperationContext, OperationInput, OperationMissingItem, OperationResult } from './operationTypes';

export type ProviderStageInput = {
  rootPath: string;
  destinationId: string;
  checkCancelled(): void;
};

export type ProviderStageResult = {
  config: ModpackConfig;
  metadata: Partial<ModpackMetadata>;
  missing: Exclude<OperationMissingItem, string>[];
};

export type ProviderInstallers = {
  curseforge(input: ProviderStageInput & { projectId: number; fileId: number }): Promise<ProviderStageResult>;
  modrinth(input: ProviderStageInput & { projectId: string; versionId: string }): Promise<ProviderStageResult>;
};

export type ProviderInstallOperationOptions = {
  installers: ProviderInstallers;
  faults?: Partial<Record<'validation' | 'publish' | 'control-plane', () => void>>;
};

export function createLiveProviderInstallers(
  modpackService: ModpackService,
  providers: { curseforge(): CurseforgeV1Client | null; modrinth(): ModrinthV2Client },
): ProviderInstallers {
  return {
    curseforge: async ({ rootPath, destinationId, projectId, fileId, checkCancelled }) => {
      const curseforge = providers.curseforge();
      if (!curseforge) throw new Error('CurseForge API key is not configured');
      const result = await downloadCurseForgeModpack(curseforge, modpackService, {
        projectId,
        fileId,
        targetModpackId: destinationId,
        rootPath,
        checkCancelled,
      });
      return toStageResult(destinationId, result);
    },
    modrinth: async ({ rootPath, destinationId, projectId, versionId, checkCancelled }) => {
      const result = await downloadModrinthModpack(providers.modrinth(), modpackService, {
        projectId,
        versionId,
        targetModpackId: destinationId,
        rootPath,
        checkCancelled,
      });
      return toStageResult(destinationId, result);
    },
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
      const controlPlaneBefore = snapshotControlPlane(rootPath);
      let backupCreated = false;
      let published = false;

      context.setRecoveryData({ destinationId, destinationName: input.name?.trim() || destinationId, missing: [] });
      try {
        const stage = input.kind === 'install-curseforge'
          ? await options.installers.curseforge({ rootPath: workspace.stagingRoot, destinationId, projectId: input.projectId, fileId: input.fileId, checkCancelled: () => throwIfCancelled(context) })
          : await options.installers.modrinth({ rootPath: workspace.stagingRoot, destinationId, projectId: input.projectId, versionId: input.versionId, checkCancelled: () => throwIfCancelled(context) });
        throwIfCancelled(context);
        context.setRecoveryData({ destinationId, destinationName: stage.config.name, missing: stage.missing, metadata: stage.metadata as Record<string, unknown> });
        workspace.markStaged(workspace.stagedModpack(destinationId));
        context.transition('staged', { completed: 1, total: 4, message: 'staged' });

        options.faults?.validation?.();
        throwIfCancelled(context);
        validateStagedProviderInstall(workspace.stagedModpack(destinationId), destinationId);
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
        commitControlPlane(rootPath, destinationId, stage.metadata);
        context.transition('control-plane-committed', { completed: 4, total: 4, message: 'control-plane-committed' });
        workspace.removePublishMarker(destinationPath);
        workspace.cleanupStaging();
        workspace.cleanupBackups();
        return stage.missing.length > 0 ? { status: 'degraded', instanceId: destinationId, missing: stage.missing } : { status: 'succeeded', instanceId: destinationId };
      } catch (error) {
        if (backupCreated && !workspace.restoreDestination(destinationPath, destinationId)) return { status: 'recovery-required', message: 'Provider rollback destination is ambiguous' };
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
      if (!recovery || !('missing' in recovery)) return { status: 'recovery-required', message: 'Provider install recovery data is missing' };
      const destinationPath = getModpackDir(context.snapshot.rootPath, recovery.destinationId);
      if (!isValidStagedProviderInstall(destinationPath, recovery.destinationId)) {
        return { status: 'recovery-required', message: 'Published provider install cannot be verified' };
      }
      try {
        commitControlPlane(context.snapshot.rootPath, recovery.destinationId, (recovery.metadata ?? {}) as Partial<ModpackMetadata>);
        context.transition('control-plane-committed', { completed: 4, total: 4, message: 'recovered-control-plane' });
        return recovery.missing.length > 0 ? { status: 'degraded', instanceId: recovery.destinationId, missing: recovery.missing } : { status: 'recovered', instanceId: recovery.destinationId };
      } catch {
        return { status: 'recovery-required', message: 'Published provider install control-plane state is ambiguous' };
      }
    },
  };
}

function defaultDestinationId(input: Extract<OperationInput, { kind: 'install-curseforge' | 'install-modrinth' }>): string {
  const seed = input.kind === 'install-curseforge' ? `curseforge-${input.projectId}-${input.fileId}` : `modrinth-${input.projectId}-${input.versionId}`;
  return seed.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').slice(0, 80) || 'provider-install';
}

function toStageResult(destinationId: string, result: { modpackId: string; config: unknown; metadata: ModpackMetadata; missing: Array<{ path: string; reason: string }> }): ProviderStageResult {
  if (result.modpackId !== destinationId) {
    throw new Error('Provider installer created an unexpected staged modpack id');
  }
  const config = result.config as ModpackConfig;
  if (config.id !== destinationId) throw new Error('Provider installer returned an invalid staged config');
  return { config, metadata: result.metadata, missing: result.missing };
}

function validateStagedProviderInstall(stagedPath: string, destinationId: string): void {
  const configPath = resolvePathWithinRoot(stagedPath, 'modpack.json', 'Staged provider install config');
  if (!fs.existsSync(configPath)) throw new Error('Staged provider install is missing modpack.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8')) as { id?: unknown; runtime?: { minecraft?: unknown } };
  if (config.id !== destinationId || typeof config.runtime?.minecraft !== 'string' || !config.runtime.minecraft) {
    throw new Error('Staged provider install config is invalid');
  }
}

function isValidStagedProviderInstall(destinationPath: string, destinationId: string): boolean {
  try {
    validateStagedProviderInstall(destinationPath, destinationId);
    return true;
  } catch {
    return false;
  }
}

function commitControlPlane(rootPath: string, destinationId: string, metadata: Partial<ModpackMetadata>): void {
  const config = loadModpackConfigFile(rootPath, destinationId);
  const index = loadModpacksIndexFile(rootPath);
  index.modpacks[destinationId] = { name: config.name };
  index.selectedModpack = destinationId;
  saveModpacksIndexFile(rootPath, index);
  const metadataIndex = loadModpacksMetadata(rootPath);
  metadataIndex.modpacks[destinationId] = { ...createModpackMetadataFromConfig(config), ...metadata, id: destinationId, name: metadata.name ?? config.name };
  metadataIndex.selectedModpack = destinationId;
  saveModpacksMetadata(rootPath, metadataIndex);
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
