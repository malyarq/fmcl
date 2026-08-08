import path from 'node:path';
import { AtomicJsonStore } from '../storage/atomicJsonStore';
import { assertAbsolutePath, assertChildName, assertPathWithinRoot } from '../../security/pathGuards';
import type { InstanceCommand } from '../../domains/instances/instanceTypes';
import type { CanonicalRecoveryCommand, OperationInput, OperationRecoveryData, OperationResult, OperationSnapshot } from './operationTypes';
import { isTerminalStatus } from './operationTypes';

type OperationJournalDocument = { operations: Record<string, OperationSnapshot> };

const MAX_TERMINAL_SNAPSHOTS = 100;
const MAX_TERMINAL_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OPERATION_KINDS = ['duplicate', 'import', 'import-share', 'install-curseforge', 'install-modrinth', 'update', 'delete', 'export'] as const;
const OPERATION_STATUSES = ['queued', 'running', 'cancelling', 'succeeded', 'recovered', 'degraded', 'cancelled', 'failed', 'recovery-required'] as const;
const OPERATION_PHASES = ['started', 'staged', 'validated', 'publish-intent', 'backup-created', 'published', 'control-plane-committed', 'completed', 'failed', 'cancelled', 'recovery-required'] as const;

export class OperationJournal {
  private readonly store: AtomicJsonStore<OperationJournalDocument>;
  private readonly rootPath: string;

  constructor(rootPath: string) {
    this.rootPath = canonicalRootPath(rootPath);
    const operationsDirectory = resolveOperationPath(this.rootPath, '.burrow-operations', 'Operation state directory');
    this.store = new AtomicJsonStore(
      path.join(operationsDirectory, 'journal.json'),
      { version: 1, validate: (value): value is OperationJournalDocument => isOperationJournalDocument(value, this.rootPath) },
    );
  }

  public get(id: string): OperationSnapshot | undefined {
    const snapshot = this.readDocument().operations[id];
    return snapshot ? clone(this.anchorRoot(snapshot)) : undefined;
  }

  public list(): OperationSnapshot[] {
    return Object.values(this.readDocument().operations).map((snapshot) => clone(this.anchorRoot(snapshot)));
  }

  public save(snapshot: OperationSnapshot): void {
    if (!isOperationSnapshot(snapshot, this.rootPath)) throw new Error('Operation snapshot is invalid for this journal root');
    const anchoredSnapshot = this.anchorRoot(snapshot);
    const document = this.readDocument();
    document.operations[anchoredSnapshot.id] = clone(anchoredSnapshot);
    this.pruneTerminalSnapshots(document);
    this.store.write(document);
  }

  private anchorRoot(snapshot: OperationSnapshot): OperationSnapshot {
    return {
      ...snapshot,
      rootPath: this.rootPath,
      input: { ...snapshot.input, rootPath: this.rootPath } as OperationInput,
    };
  }

  private readDocument(): OperationJournalDocument {
    return this.store.read()?.value ?? { operations: {} };
  }

  private pruneTerminalSnapshots(document: OperationJournalDocument): void {
    const now = Date.now();
    const terminal = Object.values(document.operations)
      .filter((snapshot) => isTerminalStatus(snapshot.status) && snapshot.status !== 'recovery-required')
      .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
    const retained = new Set(terminal.slice(0, MAX_TERMINAL_SNAPSHOTS)
      .filter((snapshot) => now - Date.parse(snapshot.updatedAt) <= MAX_TERMINAL_AGE_MS)
      .map((snapshot) => snapshot.id));
    for (const snapshot of terminal) {
      if (!retained.has(snapshot.id)) delete document.operations[snapshot.id];
    }
  }
}

function isOperationJournalDocument(value: unknown, rootPath: string): value is OperationJournalDocument {
  if (!isExactRecord(value, ['operations'])) return false;
  const operations = value.operations;
  return isRecord(operations) && Object.entries(operations).every(([id, snapshot]) => id === (snapshot as { id?: unknown })?.id && isOperationSnapshot(snapshot, rootPath));
}

function isOperationSnapshot(value: unknown, rootPath: string): value is OperationSnapshot {
  if (!isRecord(value)) return false;
  if (!hasOnlyKeys(value, ['id', 'kind', 'rootPath', 'instanceId', 'status', 'phase', 'progress', 'createdAt', 'updatedAt', 'input', 'result', 'recovery'])) return false;
  if (!isUuid(value.id) || !isOperationKind(value.kind) || !canonicalPathEquals(value.rootPath, rootPath)) return false;
  if (value.instanceId !== undefined && !isChildId(value.instanceId)) return false;
  if (!isOperationStatus(value.status) || !isOperationPhase(value.phase) || !isValidStatusPhase(value.status, value.phase)) return false;
  if (!isProgress(value.progress) || !isIsoTimestamp(value.createdAt) || !isIsoTimestamp(value.updatedAt)) return false;
  if (!isOperationInput(value.input, value.kind, rootPath)) return false;
  if (value.result !== undefined && !isOperationResult(value.result, value.status)) return false;
  return value.recovery === undefined || isRecoveryData(value.recovery, value.input, value.id);
}

function isOperationInput(value: unknown, kind: unknown, rootPath: string): value is OperationInput {
  if (!isRecord(value) || value.kind !== kind || !canonicalPathEquals(value.rootPath, rootPath)) return false;
  if (kind === 'duplicate') return hasOnlyKeys(value, ['kind', 'rootPath', 'sourceId', 'destinationId', 'name'])
    && isChildId(value.sourceId) && optionalChildId(value.destinationId) && optionalName(value.name);
  if (kind === 'import') return hasOnlyKeys(value, ['kind', 'rootPath', 'filePath', 'destinationId', 'name'])
    && isAbsolutePath(value.filePath) && optionalChildId(value.destinationId) && optionalName(value.name);
  if (kind === 'import-share') return hasOnlyKeys(value, ['kind', 'rootPath', 'shareCode']) && isShareCode(value.shareCode);
  if (kind === 'install-curseforge') return hasOnlyKeys(value, ['kind', 'rootPath', 'projectId', 'fileId', 'destinationId', 'name'])
    && isPositiveInteger(value.projectId) && isPositiveInteger(value.fileId) && optionalChildId(value.destinationId) && optionalName(value.name);
  if (kind === 'install-modrinth') return hasOnlyKeys(value, ['kind', 'rootPath', 'projectId', 'versionId', 'destinationId', 'name'])
    && isIdentifier(value.projectId) && isIdentifier(value.versionId) && optionalChildId(value.destinationId) && optionalName(value.name);
  if (kind === 'update') return hasOnlyKeys(value, ['kind', 'rootPath', 'instanceId', 'manifestUrl'])
    && isChildId(value.instanceId) && isPublicHttpsUrl(value.manifestUrl);
  if (kind === 'delete') return hasOnlyKeys(value, ['kind', 'rootPath', 'instanceId']) && isChildId(value.instanceId);
  if (kind !== 'export' || !isChildId(value.instanceId)) return false;
  if (value.format === 'manifest') return hasOnlyKeys(value, ['kind', 'rootPath', 'instanceId', 'format', 'name', 'version', 'author'])
    && isName(value.name, 120) && isName(value.version, 64) && optionalName(value.author);
  return (value.format === 'zip' || value.format === 'multimc')
    && hasOnlyKeys(value, ['kind', 'rootPath', 'instanceId', 'format', 'outputPath', 'options'])
    && isAbsolutePath(value.outputPath) && isExportOptions(value.options);
}

function isRecoveryData(value: unknown, input: OperationInput, operationId: string): value is OperationRecoveryData {
  if (!isRecord(value)) return false;
  const canonical = value.canonicalCommand;
  if (canonical !== undefined && !isCanonicalRecoveryCommand(canonical, canonicalRootPath(input.rootPath), operationId)) return false;
  if (isArchiveInput(input)) return hasOnlyKeys(value, ['outputPath', 'workspacePath', 'stagedPath', 'backupPath', 'hadOutput', 'digest', 'canonicalCommand'])
    && isArchiveRecovery(value, input.outputPath, operationId);
  if (input.kind === 'duplicate') return hasOnlyKeys(value, ['sourceId', 'destinationId', 'destinationName', 'publishIntent', 'canonicalCommand'])
    && value.sourceId === input.sourceId && isChildId(value.destinationId) && isName(value.destinationName, 120)
    && (!input.destinationId || value.destinationId === input.destinationId) && optionalPublishIntent(value.publishIntent, value.destinationId);
  if (input.kind === 'import' || input.kind === 'import-share' || input.kind === 'install-curseforge' || input.kind === 'install-modrinth') {
    const requestedDestinationId = 'destinationId' in input ? input.destinationId : undefined;
    return hasOnlyKeys(value, ['destinationId', 'destinationName', 'missing', 'metadata', 'publishIntent', 'canonicalCommand'])
      && isChildId(value.destinationId) && isName(value.destinationName, 120) && isMissingList(value.missing)
      && (!requestedDestinationId || value.destinationId === requestedDestinationId) && optionalJsonRecord(value.metadata)
      && optionalPublishIntent(value.publishIntent, value.destinationId);
  }
  const destinationId = input.kind === 'update' || input.kind === 'delete' || input.kind === 'export' ? input.instanceId : undefined;
  return destinationId !== undefined && hasOnlyKeys(value, ['destinationId', 'publishIntent', 'canonicalCommand'])
    && value.destinationId === destinationId && optionalPublishIntent(value.publishIntent, destinationId);
}

function isCanonicalRecoveryCommand(value: unknown, rootPath: string, operationId: string): value is CanonicalRecoveryCommand {
  return isExactRecord(value, ['version', 'rootPath', 'operationId', 'command'])
    && value.version === 1
    && canonicalPathEquals(value.rootPath, rootPath)
    && value.operationId === operationId
    && isInstanceCommand(value.command);
}

function isInstanceCommand(value: unknown): value is InstanceCommand {
  if (!isRecord(value) || value.version !== 1 || typeof value.type !== 'string') return false;
  switch (value.type) {
    case 'create':
      return hasOnlyKeys(value, ['version', 'type', 'name', 'source', 'config'])
        && isName(value.name, 120) && isSource(value.source, false) && isInstanceConfig(value.config);
    case 'rename':
      return hasOnlyKeys(value, ['version', 'type', 'id', 'name']) && isChildId(value.id) && isName(value.name, 120);
    case 'select':
    case 'delete':
      return hasOnlyKeys(value, ['version', 'type', 'id']) && isChildId(value.id);
    case 'save-config':
      return hasOnlyKeys(value, ['version', 'type', 'id', 'config']) && isChildId(value.id) && isInstanceConfig(value.config);
    case 'update-metadata':
      return hasOnlyKeys(value, ['version', 'type', 'id', 'description'])
        && isChildId(value.id) && optionalDescription(value.description);
    case 'commit-published':
      return hasOnlyKeys(value, ['version', 'type', 'record', 'select'])
        && isCanonicalRecord(value.record) && (value.select === undefined || typeof value.select === 'boolean');
    case 'reconcile-update':
      return hasOnlyKeys(value, ['version', 'type', 'record']) && isCanonicalRecord(value.record);
    default:
      return false;
  }
}

function isCanonicalRecord(value: unknown): boolean {
  return isExactRecord(value, ['id', 'name', 'source', 'config', 'summary'])
    && isChildId(value.id) && isName(value.name, 120) && isSource(value.source, true)
    && isInstanceConfig(value.config) && isSummary(value.summary, value.config);
}

function isSource(value: unknown, timestampsRequired: boolean): boolean {
  if (!isRecord(value)) return false;
  const keys = ['source', 'sourceId', 'sourceVersionId', 'version', 'iconUrl', 'description', 'author', ...(timestampsRequired ? ['createdAt', 'updatedAt'] : [])];
  if (!hasOnlyKeys(value, keys) || !['local', 'curseforge', 'modrinth'].includes(value.source as string)) return false;
  for (const key of ['sourceId', 'sourceVersionId', 'version', 'iconUrl', 'description', 'author']) {
    if (value[key] !== undefined && !isText(value[key], 4096)) return false;
  }
  return !timestampsRequired || (isIsoTimestamp(value.createdAt) && isIsoTimestamp(value.updatedAt));
}

function isInstanceConfig(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value) || !hasOnlyKeys(value, ['runtime', 'java', 'memory', 'vmOptions', 'game', 'server', 'networkMode']) || !isRecord(value.runtime)) return false;
  if (!hasOnlyKeys(value.runtime, ['minecraftVersion', 'modLoader']) || !isText(value.runtime.minecraftVersion, 120)) return false;
  if (value.runtime.modLoader !== undefined && (!isRecord(value.runtime.modLoader) || !hasOnlyKeys(value.runtime.modLoader, ['type', 'version'])
    || !['vanilla', 'forge', 'fabric', 'quilt', 'neoforge'].includes(value.runtime.modLoader.type as string)
    || (value.runtime.modLoader.version !== undefined && !isText(value.runtime.modLoader.version, 120)))) return false;
  if (value.java !== undefined && (!isRecord(value.java) || !hasOnlyKeys(value.java, ['executable']) || (value.java.executable !== undefined && !isText(value.java.executable, 4096)))) return false;
  if (value.memory !== undefined && (!isRecord(value.memory) || !hasOnlyKeys(value.memory, ['maxMb', 'minMb']) || !isPositiveInteger(value.memory.maxMb)
    || (value.memory.minMb !== undefined && !isPositiveInteger(value.memory.minMb)))) return false;
  if (value.vmOptions !== undefined && (!Array.isArray(value.vmOptions) || value.vmOptions.some((item) => !isText(item, 4096)))) return false;
  if (value.game !== undefined && !isGameConfig(value.game)) return false;
  if (value.server !== undefined && (!isRecord(value.server) || !hasOnlyKeys(value.server, ['host', 'port']) || !isText(value.server.host, 255) || !isPositiveInteger(value.server.port))) return false;
  return value.networkMode === undefined || ['hyperswarm', 'xmcl_lan', 'xmcl_upnp_host'].includes(value.networkMode as string);
}

function isGameConfig(value: unknown): boolean {
  if (!isRecord(value) || !hasOnlyKeys(value, ['resolution', 'extraArgs'])) return false;
  if (value.resolution !== undefined && (!isRecord(value.resolution) || !hasOnlyKeys(value.resolution, ['width', 'height', 'fullscreen'])
    || (value.resolution.width !== undefined && !isPositiveInteger(value.resolution.width))
    || (value.resolution.height !== undefined && !isPositiveInteger(value.resolution.height))
    || (value.resolution.fullscreen !== undefined && typeof value.resolution.fullscreen !== 'boolean'))) return false;
  return value.extraArgs === undefined || (Array.isArray(value.extraArgs) && value.extraArgs.every((item) => isText(item, 4096)));
}

function isSummary(value: unknown, config: Record<string, unknown>): boolean {
  if (!isRecord(value) || !hasOnlyKeys(value, ['minecraftVersion', 'modLoader']) || value.minecraftVersion !== (config.runtime as Record<string, unknown>).minecraftVersion) return false;
  const configLoader = (config.runtime as Record<string, unknown>).modLoader;
  if (configLoader === undefined) return value.modLoader === undefined;
  return isRecord(value.modLoader) && isRecord(configLoader)
    && hasOnlyKeys(value.modLoader, ['type', 'version'])
    && value.modLoader.type === configLoader.type && value.modLoader.version === configLoader.version;
}

function isArchiveRecovery(value: Record<string, unknown>, outputPath: string, operationId: string): boolean {
  if (!hasOnlyKeys(value, ['outputPath', 'workspacePath', 'stagedPath', 'backupPath', 'hadOutput', 'digest'])) return false;
  if (typeof value.outputPath !== 'string' || typeof value.workspacePath !== 'string' || typeof value.stagedPath !== 'string' || typeof value.backupPath !== 'string' || typeof value.hadOutput !== 'boolean') return false;
  const expectedOutputPath = canonicalAbsolutePath(outputPath);
  const recoveryOutputPath = canonicalAbsolutePath(value.outputPath);
  if (!expectedOutputPath || recoveryOutputPath !== expectedOutputPath) return false;
  const workspacePath = path.join(path.dirname(expectedOutputPath), `.${path.basename(expectedOutputPath)}.burrow-export-${operationId}`);
  return canonicalAbsolutePath(value.workspacePath) === workspacePath
    && canonicalAbsolutePath(value.stagedPath) === path.join(workspacePath, 'archive.zip')
    && canonicalAbsolutePath(value.backupPath) === path.join(workspacePath, 'previous-output.zip')
    && (value.digest === undefined || (typeof value.digest === 'string' && /^[a-f0-9]{64}$/i.test(value.digest)));
}

function isOperationResult(value: unknown, status: unknown): value is OperationResult {
  if (!isRecord(value) || value.status !== status) return false;
  if (status === 'succeeded') return hasOnlyKeys(value, ['status', 'instanceId']) && isChildId(value.instanceId);
  if (status === 'recovered') return hasOnlyKeys(value, ['status', 'instanceId']) && optionalChildId(value.instanceId);
  if (status === 'degraded') return hasOnlyKeys(value, ['status', 'instanceId', 'missing']) && optionalChildId(value.instanceId) && isMissingList(value.missing);
  if (status === 'cancelled') return hasOnlyKeys(value, ['status']);
  if (status === 'failed') return hasOnlyKeys(value, ['status', 'code', 'message']) && isErrorCode(value.code) && isText(value.message, 240);
  if (status === 'recovery-required') return hasOnlyKeys(value, ['status', 'message']) && isText(value.message, 240);
  return false;
}

function isProgress(value: unknown): boolean {
  return isRecord(value) && hasOnlyKeys(value, ['completed', 'total', 'message'])
    && isNonNegativeInteger(value.completed) && isNonNegativeInteger(value.total) && (value.message === undefined || isText(value.message, 120));
}

function isValidStatusPhase(status: string, phase: string): boolean {
  if (status === 'succeeded' || status === 'recovered' || status === 'degraded') return phase === 'completed';
  if (status === 'failed') return phase === 'failed';
  if (status === 'cancelled') return phase === 'cancelled';
  if (status === 'recovery-required') return phase === 'recovery-required';
  return !['completed', 'failed', 'cancelled', 'recovery-required'].includes(phase);
}

function isMissingList(value: unknown): boolean {
  return Array.isArray(value) && value.length <= 1000 && value.every((item) => typeof item === 'string'
    ? isLogicalPath(item)
    : isExactRecord(item, ['path', 'reason']) && isLogicalPath(item.path) && isText(item.reason, 120));
}

function optionalPublishIntent(value: unknown, destinationId: unknown): boolean {
  return value === undefined || isExactRecord(value, ['destinationId', 'destinationExisted'])
    && value.destinationId === destinationId && typeof value.destinationExisted === 'boolean';
}

function isArchiveInput(input: OperationInput): input is Extract<OperationInput, { kind: 'export'; format: 'zip' | 'multimc' }> {
  return input.kind === 'export' && (input.format === 'zip' || input.format === 'multimc');
}

function canonicalRootPath(value: string): string {
  return assertPathWithinRoot(value, value, 'Operation root path');
}

function canonicalPathEquals(value: unknown, expectedRootPath: string): boolean {
  return typeof value === 'string' && (() => {
    try { return canonicalRootPath(value) === expectedRootPath; } catch { return false; }
  })();
}

function resolveOperationPath(rootPath: string, relativePath: string, label: string): string {
  return assertPathWithinRoot(rootPath, path.join(rootPath, relativePath), label);
}

function isAbsolutePath(value: unknown): value is string {
  return normalizedPathCandidate(value) !== undefined;
}

function canonicalAbsolutePath(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  try {
    const absolutePath = assertAbsolutePath(value, 'Operation path');
    return assertPathWithinRoot(path.dirname(absolutePath), absolutePath, 'Operation path');
  } catch { return undefined; }
}

function normalizedPathCandidate(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  try { return assertAbsolutePath(value, 'Operation path'); } catch { return undefined; }
}

function isChildId(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 120) return false;
  try { return assertChildName(value, 'Operation child id') === value; } catch { return false; }
}

function isLogicalPath(value: unknown): boolean {
  return typeof value === 'string' && value.length > 0 && value.length <= 240 && !value.startsWith('/')
    && !value.startsWith('\\') && !/^[a-z]:/i.test(value) && !value.split(/[\\/]+/).some((part) => !part || part === '.' || part === '..');
}

function isUuid(value: unknown): value is string { return typeof value === 'string' && UUID_RE.test(value); }
function isOperationKind(value: unknown): value is OperationSnapshot['kind'] { return typeof value === 'string' && OPERATION_KINDS.includes(value as OperationSnapshot['kind']); }
function isOperationStatus(value: unknown): value is OperationSnapshot['status'] { return typeof value === 'string' && OPERATION_STATUSES.includes(value as OperationSnapshot['status']); }
function isOperationPhase(value: unknown): value is OperationSnapshot['phase'] { return typeof value === 'string' && OPERATION_PHASES.includes(value as OperationSnapshot['phase']); }
function isPositiveInteger(value: unknown): boolean { return Number.isSafeInteger(value) && (value as number) > 0; }
function isNonNegativeInteger(value: unknown): boolean { return Number.isSafeInteger(value) && (value as number) >= 0; }
function isIdentifier(value: unknown): boolean { return typeof value === 'string' && /^[a-zA-Z0-9._-]{1,160}$/.test(value); }
function isShareCode(value: unknown): boolean {
  if (typeof value !== 'string' || value.length < 4 || value.length > 32_768) return false;
  const prefix = 'burrow://share/v1/';
  const payload = value.startsWith(prefix) ? value.slice(prefix.length) : value;
  return /^[A-Za-z0-9+/=_-]+$/.test(payload);
}
function isErrorCode(value: unknown): boolean { return typeof value === 'string' && /^[A-Z0-9_]{1,64}$/.test(value); }
function isText(value: unknown, maxLength: number): boolean { return typeof value === 'string' && value.length > 0 && value.length <= maxLength; }
function isName(value: unknown, maxLength: number): boolean { return isText(value, maxLength) && Boolean((value as string).trim()); }
function optionalName(value: unknown): boolean { return value === undefined || isName(value, 120); }
function optionalDescription(value: unknown): boolean { return value === undefined || typeof value === 'string' && isText(value, 4_000) && Boolean(value.trim()); }
function optionalChildId(value: unknown): boolean { return value === undefined || isChildId(value); }
function optionalJsonRecord(value: unknown): boolean { return value === undefined || isRecord(value) && isJsonValue(value, 0); }
function isJsonValue(value: unknown, depth: number): boolean {
  if (depth > 16 || value === null || typeof value === 'string' || typeof value === 'boolean') return depth <= 16;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.length <= 1000 && value.every((item) => isJsonValue(item, depth + 1));
  return isRecord(value) && Object.keys(value).length <= 1000 && Object.values(value).every((item) => isJsonValue(item, depth + 1));
}
function isExportOptions(value: unknown): boolean {
  return value === undefined || isRecord(value) && hasOnlyKeys(value, ['includeSaves', 'includeScreenshots', 'includeResourcePacks', 'includeShaders', 'includeMods'])
    && Object.values(value).every((item) => typeof item === 'boolean');
}
function isPublicHttpsUrl(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && Boolean(url.hostname)
      && url.hostname !== 'localhost' && url.hostname !== '::1' && !url.hostname.startsWith('127.') && !url.hostname.startsWith('10.')
      && !url.hostname.startsWith('192.168.') && !/^172\.(1[6-9]|2\d|3[01])\./.test(url.hostname);
  } catch { return false; }
}
function isIsoTimestamp(value: unknown): boolean {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) return false;
  return new Date(value).toISOString() === value;
}
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
function hasOnlyKeys(value: Record<string, unknown>, allowed: string[]): boolean { return Object.keys(value).every((key) => allowed.includes(key)); }
function isExactRecord(value: unknown, keys: string[]): value is Record<string, unknown> { return isRecord(value) && Object.keys(value).length === keys.length && keys.every((key) => key in value); }

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
