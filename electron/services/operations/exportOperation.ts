import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { assertAbsolutePath, assertChildName, resolvePathWithinRoot } from '../../security/pathGuards';
import type { InstanceCommand } from '../../domains/instances/instanceTypes';
import { getModpackDir, resolveLauncherRootPath } from '../instances/paths';
import { exportToZip } from '../modpacks/exporters/zipExporter';
import { generateManifestFromInstance } from '../modpacks/exporters/manifestGenerator';
import type { ModPlatformService } from '../mods/platform/modPlatformService';
import { readCanonicalRecordFromContent } from './canonicalRecord';
import { StagingWorkspace } from './stagingWorkspace';
import type {
  ArchiveExportOperationInput,
  ManifestExportOperationInput,
  OperationAdapter,
  OperationContext,
  OperationResult,
} from './operationTypes';

type ExportFault = 'write' | 'validation' | 'publish' | 'control-plane';

export type ArchiveWriteInput = Pick<ArchiveExportOperationInput, 'rootPath' | 'instanceId' | 'format' | 'outputPath' | 'options'>;

export type ExportOperationOptions = {
  faults?: Partial<Record<ExportFault, () => void>>;
  hooks?: {
    afterBackup?: () => void | Promise<void>;
  };
  writeArchive?: (input: ArchiveWriteInput) => Promise<void>;
  platformService?: ModPlatformService;
};

/**
 * Owns both portable archive export and manifest publication. Manifest export stages a full
 * instance copy so its manifest and canonical control-plane command are never live-mutated
 * before validation, backup and operation journaling have completed.
 */
export function createExportOperationAdapter(options: ExportOperationOptions = {}): OperationAdapter {
  return {
    kind: 'export',
    async run(context): Promise<OperationResult> {
      const input = context.snapshot.input;
      if (input.kind !== 'export') throw new Error('Export adapter received an invalid input');
      return input.format === 'manifest'
        ? runManifestExport(context, input, options)
        : runArchiveExport(context, input, options);
    },
    async recoverPublished(context): Promise<OperationResult> {
      const input = context.snapshot.input;
      if (input.kind !== 'export') return { status: 'recovery-required', message: 'Export recovery input is invalid' };
      if (input.format !== 'manifest') {
        return recoverArchiveExport(context);
      }

      return await context.replayCanonicalCommand();
    },
  };
}

async function runArchiveExport(
  context: OperationContext,
  input: ArchiveExportOperationInput,
  options: ExportOperationOptions,
): Promise<OperationResult> {
  const rootPath = resolveLauncherRootPath(input.rootPath);
  const instanceId = assertChildName(input.instanceId, 'Exported modpack id');
  const outputPath = assertAbsolutePath(input.outputPath, 'Archive export output path');
  const workspace = privateSiblingWorkspacePath(outputPath, context.snapshot.id);
  const stagedPath = resolvePathWithinRoot(workspace, 'archive.zip', 'Staged archive output');
  const backupPath = resolvePathWithinRoot(workspace, 'previous-output.zip', 'Archive output backup');
  let backupCreated = false;
  let digest: string | undefined;

  // Persist deterministic residue locations before even creating the sibling
  // workspace. A crash in setup is therefore discoverable on the next scan.
  context.setRecoveryData({ outputPath, workspacePath: workspace, stagedPath, backupPath, hadOutput: fs.existsSync(outputPath) });
  createPrivateSiblingWorkspace(workspace);

  try {
    options.faults?.write?.();
    await (options.writeArchive ?? writeZipArchive)({
      rootPath,
      instanceId,
      format: input.format,
      outputPath: stagedPath,
      options: input.options,
    });
    throwIfCancelled(context);
    context.transition('staged', { completed: 1, total: 3, message: 'staged' });

    options.faults?.validation?.();
    validateClosedArchive(stagedPath);
    digest = digestFile(stagedPath);
    context.setRecoveryData({ outputPath, workspacePath: workspace, stagedPath, backupPath, hadOutput: fs.existsSync(outputPath), digest });
    throwIfCancelled(context);
    context.transition('validated', { completed: 2, total: 3, message: 'validated' });

    if (fs.existsSync(outputPath)) {
      context.transition('publish-intent', { completed: 2, total: 3, message: 'publish-intent' });
      fs.renameSync(outputPath, backupPath);
      backupCreated = true;
      context.transition('backup-created', { completed: 2, total: 3, message: 'backup-created' });
    }
    await options.hooks?.afterBackup?.();
    throwIfCancelled(context);
    options.faults?.publish?.();
    if (!backupCreated) context.transition('publish-intent', { completed: 2, total: 3, message: 'publish-intent' });
    publishArchiveNoReplace(stagedPath, outputPath);
    context.transition('published', { completed: 3, total: 3, message: 'published' });

    fs.rmSync(workspace, { recursive: true, force: true });
    return { status: 'succeeded', instanceId };
  } catch (error) {
    if (backupCreated && fs.existsSync(backupPath)) {
      if (fs.existsSync(outputPath) && (!digest || digestFile(outputPath) !== digest)) {
        return { status: 'recovery-required', message: 'Archive output changed during rollback; files were preserved' };
      }
      if (fs.existsSync(outputPath)) fs.rmSync(outputPath, { force: true });
      fs.renameSync(backupPath, outputPath);
      fsyncDirectory(path.dirname(outputPath));
    }
    fs.rmSync(workspace, { recursive: true, force: true });
    throw error;
  }
}

async function runManifestExport(
  context: OperationContext,
  input: ManifestExportOperationInput,
  options: ExportOperationOptions,
): Promise<OperationResult> {
  const rootPath = resolveLauncherRootPath(input.rootPath);
  const instanceId = assertChildName(input.instanceId, 'Exported modpack id');
  const destinationPath = getModpackDir(rootPath, instanceId);
  if (!fs.existsSync(destinationPath)) throw new Error(`Modpack ${instanceId} not found`);

  const workspace = new StagingWorkspace(rootPath, context.snapshot.id);
  let backupCreated = false;

  context.setRecoveryData({ destinationId: instanceId });
  try {
    const stagedPath = workspace.stageCopy(destinationPath, instanceId);
    options.faults?.write?.();
    const manifest = await generateManifestFromInstance(stagedPath, input.name, input.version, input.author, options.platformService);
    await fs.promises.writeFile(
      resolvePathWithinRoot(stagedPath, 'manifest.json', 'Staged manifest output'),
      JSON.stringify(manifest, null, 2),
      { encoding: 'utf8', mode: 0o600 },
    );
    throwIfCancelled(context);
    context.transition('staged', { completed: 1, total: 4, message: 'staged' });

    options.faults?.validation?.();
    validatePublishedManifest(stagedPath, input);
    const command = canonicalManifestCommand(stagedPath, instanceId, input);
    context.recordCanonicalCommand(command);
    throwIfCancelled(context);
    context.transition('validated', { completed: 2, total: 4, message: 'validated' });

    options.faults?.publish?.();
    context.setPublishIntent(instanceId, true, { completed: 2, total: 4, message: 'publish-intent' });
    backupCreated = workspace.createBackup(destinationPath, instanceId);
    if (!backupCreated) throw new Error(`Modpack ${instanceId} disappeared before manifest publish`);
    context.transition('backup-created', { completed: 2, total: 4, message: 'backup-created' });
    await options.hooks?.afterBackup?.();
    throwIfCancelled(context);

    workspace.publish(destinationPath, instanceId);
    context.transition('published', { completed: 3, total: 4, message: 'published' });
    throwIfCancelled(context);

    options.faults?.['control-plane']?.();
    await commitControlPlane(context, command);
    context.transition('control-plane-committed', { completed: 4, total: 4, message: 'control-plane-committed' });
    workspace.removePublishMarker(destinationPath);
    workspace.cleanupStaging();
    workspace.cleanupBackups();
    return { status: 'succeeded', instanceId };
  } catch (error) {
    if (backupCreated && !workspace.restoreDestination(destinationPath, instanceId)) return { status: 'recovery-required', message: 'Manifest rollback destination is ambiguous' };
    workspace.cleanupStaging();
    if (backupCreated) workspace.cleanupBackups();
    throw error;
  }
}

async function writeZipArchive(input: ArchiveWriteInput): Promise<void> {
  if (input.format !== 'zip') throw new Error('MultiMC archive export requires the configured instance exporter');
  const sourcePath = getModpackDir(input.rootPath, input.instanceId);
  if (!fs.existsSync(sourcePath)) throw new Error(`Modpack ${input.instanceId} not found`);
  await exportToZip(sourcePath, input.outputPath);
}

function canonicalManifestCommand(stagedPath: string, instanceId: string, input: ManifestExportOperationInput): InstanceCommand {
  const record = readCanonicalRecordFromContent(stagedPath, instanceId);
  return {
    version: 1,
    type: 'reconcile-update',
    record: {
      ...record,
      name: input.name,
      source: {
        ...record.source,
        version: input.version,
        ...(input.author === undefined ? {} : { author: input.author }),
      },
    },
  };
}

async function commitControlPlane(context: OperationContext, command: InstanceCommand): Promise<void> {
  const result = await context.commitControlPlane(command);
  if ('code' in result) throw new Error(result.message);
}

function validatePublishedManifest(instancePath: string, input: ManifestExportOperationInput): void {
  const manifestPath = resolvePathWithinRoot(instancePath, 'manifest.json', 'Manifest output');
  if (!fs.existsSync(manifestPath)) throw new Error('Staged manifest output is missing');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
    formatVersion?: unknown;
    name?: unknown;
    version?: unknown;
    minecraft?: { version?: unknown };
  };
  if (
    manifest.formatVersion !== 1
    || manifest.name !== input.name
    || manifest.version !== input.version
    || typeof manifest.minecraft?.version !== 'string'
    || !manifest.minecraft.version
  ) {
    throw new Error('Staged manifest output is invalid');
  }
}

function privateSiblingWorkspacePath(outputPath: string, operationId: string): string {
  return path.join(path.dirname(outputPath), `.${path.basename(outputPath)}.burrow-export-${operationId}`);
}

function createPrivateSiblingWorkspace(workspace: string): void {
  const outputDirectory = path.dirname(workspace);
  fs.mkdirSync(outputDirectory, { recursive: true });
  fs.mkdirSync(workspace, { recursive: false });
}

function recoverArchiveExport(context: OperationContext): OperationResult {
  // Archive output is an external, user-selected path. Its one-time native-save
  // authorization is intentionally not persisted, so a journal record alone
  // can never authorize post-restart filesystem mutations at this location.
  // Keep every artifact intact for explicit user recovery.
  void context;
  return { status: 'recovery-required', message: 'Archive export recovery requires manual verification' };
}

function digestFile(filePath: string): string {
  return createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

/** Link+unlink gives no-replace publish semantics on the sibling filesystem. */
function publishArchiveNoReplace(stagedPath: string, outputPath: string): void {
  fs.linkSync(stagedPath, outputPath);
  fsyncDirectory(path.dirname(outputPath));
  fs.unlinkSync(stagedPath);
  fsyncDirectory(path.dirname(stagedPath));
}

function fsyncDirectory(directory: string): void {
  try {
    const descriptor = fs.openSync(directory, 'r');
    try { fs.fsyncSync(descriptor); } finally { fs.closeSync(descriptor); }
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (!['EINVAL', 'ENOTSUP', 'EPERM', 'EISDIR'].includes(code ?? '')) throw error;
  }
}

function validateClosedArchive(stagedPath: string): void {
  const stats = fs.statSync(stagedPath);
  if (!stats.isFile() || stats.size === 0) throw new Error('Staged archive output is invalid');
  const descriptor = fs.openSync(stagedPath, 'r');
  try {
    const header = Buffer.alloc(4);
    if (fs.readSync(descriptor, header, 0, header.length, 0) !== header.length || !header.subarray(0, 2).equals(Buffer.from('PK'))) {
      throw new Error('Staged archive output is invalid');
    }
  } finally {
    fs.closeSync(descriptor);
  }
}

function throwIfCancelled(context: OperationContext): void {
  if (context.isCancelled()) throw new Error('Operation cancelled');
}
