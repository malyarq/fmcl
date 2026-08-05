import { ipcMain, type IpcMainInvokeEvent } from 'electron';
import { assertAbsolutePath, assertChildName } from '../../security/pathGuards';
import { consumeArchiveReference as consumeMainArchiveReference } from '../../security/archiveReferenceAuthorizations';
import { consumeAuthorizedSavePath } from '../../security/savePathAuthorizations';
import { resolveApprovedLauncherRootPath } from '../../services/instances/paths';
import { validateExportOptions, validateModpackExportFormat, validateShareCode } from '../validation/privilegedPayloads';
import type { OperationRunner } from '../../services/operations/operationRunner';
import type {
  OperationInput,
  OperationSnapshot as InternalOperationSnapshot,
} from '../../services/operations/operationTypes';
import type {
  OperationSnapshot,
} from '../../../shared/contracts/operations';

const OPERATION_ID_RE = /^(?:recovery-)?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_NAME_LENGTH = 120;

type Subscription = {
  senderId: number;
  unsubscribe: () => void;
};

type ArchiveReferenceConsumer = (ownerId: number, reference: string) => string;

type OperationsHandlerDependencies = Readonly<{
  runner: OperationRunner;
  consumeArchiveReference?: ArchiveReferenceConsumer;
}>;

type ValidatedOperationStart = Exclude<OperationInput, { kind: 'import' }> | Omit<Extract<OperationInput, { kind: 'import' }>, 'filePath'> & {
  archiveRef: string;
};

export function registerOperationsHandlers({
  runner,
  consumeArchiveReference = consumeMainArchiveReference,
}: OperationsHandlerDependencies): void {
  const owners = new Map<string, number>();
  const subscriptions = new Map<string, Subscription>();

  const removeSubscription = (senderId: number, operationId: string): void => {
    const key = subscriptionKey(senderId, operationId);
    const subscription = subscriptions.get(key);
    if (!subscription) return;
    subscription.unsubscribe();
    subscriptions.delete(key);
  };

  ipcMain.removeHandler('operations:start');
  ipcMain.handle('operations:start', async (event, input: unknown) => {
    const validated = validateStartRequest(input, event.sender.id);
    await runner.prepareRoot(validated.rootPath);
    // Consumption is deliberately the final privileged action before start:
    // preparation cannot turn a single-use renderer capability into durable state.
    const request = resolveOperationInput(validated, event.sender.id, consumeArchiveReference);
    const snapshot = runner.start(request);
    owners.set(snapshot.id, event.sender.id);
    return toPublicSnapshot(snapshot);
  });

  ipcMain.removeHandler('operations:get');
  ipcMain.handle('operations:get', async (event, operationId: unknown) => {
    const snapshot = runner.get(validateOperationId(operationId));
    if (!snapshot) return null;
    assertReadable(event, snapshot, owners);
    return toPublicSnapshot(snapshot);
  });

  ipcMain.removeHandler('operations:listRecovered');
  ipcMain.handle('operations:listRecovered', async () => runner.listRecovered().map(toPublicSnapshot));

  ipcMain.removeHandler('operations:cancel');
  ipcMain.handle('operations:cancel', async (event, operationId: unknown) => {
    const id = validateOperationId(operationId);
    const snapshot = runner.get(id);
    if (!snapshot) return { cancelled: false };
    if (isRecoveredTerminal(snapshot)) return { cancelled: false };
    assertOwned(event, snapshot.id, owners);
    return { cancelled: runner.cancel(id) };
  });

  ipcMain.removeHandler('operations:subscribe');
  ipcMain.handle('operations:subscribe', async (event, operationId: unknown) => {
    const id = validateOperationId(operationId);
    const snapshot = runner.get(id);
    if (!snapshot) throw new Error('Operation was not found');
    assertReadable(event, snapshot, owners);
    removeSubscription(event.sender.id, id);
    if (isRecoveredTerminal(snapshot)) {
      sendSnapshot(event, snapshot);
      return { ok: true };
    }

    const unsubscribe = runner.subscribe(id, (updatedSnapshot) => sendSnapshot(event, updatedSnapshot));
    subscriptions.set(subscriptionKey(event.sender.id, id), { senderId: event.sender.id, unsubscribe });
    sendSnapshot(event, snapshot);
    return { ok: true };
  });

  ipcMain.removeAllListeners('operations:unsubscribe');
  ipcMain.on('operations:unsubscribe', (event, operationId: unknown) => {
    if (!isOperationId(operationId)) return;
    removeSubscription(event.sender.id, operationId);
  });
}

function validateStartRequest(value: unknown, senderId: number): ValidatedOperationStart {
  if (!isRecord(value)) throw new Error('Operation request is invalid');
  const rootPath = resolveApprovedLauncherRootPath();
  if (value.kind === 'import') {
    const archiveRef = requireString(value.archiveRef, 'Archive reference');
    const destinationId = value.destinationId === undefined
      ? undefined
      : assertChildName(requireString(value.destinationId, 'Destination modpack id'), 'Destination modpack id');
    const name = value.name === undefined ? undefined : validateName(value.name, 'Imported modpack name');
    return { kind: 'import', rootPath, archiveRef, destinationId, name };
  }
  if (value.kind === 'import-share') {
    return { kind: 'import-share', rootPath, shareCode: validateShareCode(value.code) };
  }
  if (value.kind === 'install-curseforge') {
    const projectId = requirePositiveInteger(value.projectId, 'CurseForge project id');
    const fileId = requirePositiveInteger(value.fileId, 'CurseForge file id');
    const destinationId = value.destinationId === undefined ? undefined : assertChildName(requireString(value.destinationId, 'Destination modpack id'), 'Destination modpack id');
    const name = value.name === undefined ? undefined : validateName(value.name, 'CurseForge modpack name');
    return { kind: 'install-curseforge', rootPath, projectId, fileId, destinationId, name };
  }
  if (value.kind === 'install-modrinth') {
    const projectId = requireIdentifier(value.projectId, 'Modrinth project id');
    const versionId = requireIdentifier(value.versionId, 'Modrinth version id');
    const destinationId = value.destinationId === undefined ? undefined : assertChildName(requireString(value.destinationId, 'Destination modpack id'), 'Destination modpack id');
    const name = value.name === undefined ? undefined : validateName(value.name, 'Modrinth modpack name');
    return { kind: 'install-modrinth', rootPath, projectId, versionId, destinationId, name };
  }
  if (value.kind === 'update') {
    const instanceId = assertChildName(requireString(value.instanceId, 'Updated modpack id'), 'Updated modpack id');
    const manifestUrl = validatePublicHttpsUrl(value.manifestUrl, 'Updater manifest URL');
    return { kind: 'update', rootPath, instanceId, manifestUrl };
  }
  if (value.kind === 'delete') {
    const instanceId = assertChildName(requireString(value.instanceId, 'Deleted modpack id'), 'Deleted modpack id');
    return { kind: 'delete', rootPath, instanceId };
  }
  if (value.kind === 'export') {
    const instanceId = assertChildName(requireString(value.instanceId, 'Exported modpack id'), 'Exported modpack id');
    if (value.format === 'manifest') {
      return {
        kind: 'export',
        rootPath,
        instanceId,
        format: 'manifest',
        name: validateName(value.name, 'Manifest name'),
        version: validateVersion(value.version, 'Manifest version'),
        author: value.author === undefined ? undefined : validateName(value.author, 'Manifest author'),
      };
    }
    const format = validateModpackExportFormat(value.format);
    if (format !== 'zip' && format !== 'multimc') throw new Error('Archive export format is not supported');
    const requestedOutputPath = assertAbsolutePath(requireString(value.outputPath, 'Archive export output path'), 'Archive export output path');
    const options = validateExportOptions(value.options);
    const outputPath = consumeAuthorizedSavePath(senderId, requestedOutputPath);
    return { kind: 'export', rootPath, instanceId, format, outputPath, options };
  }
  if (value.kind !== 'duplicate') throw new Error('Operation kind is not supported');
  const sourceId = assertChildName(requireString(value.sourceId, 'Source modpack id'), 'Source modpack id');
  const destinationId = value.destinationId === undefined
    ? undefined
    : assertChildName(requireString(value.destinationId, 'Destination modpack id'), 'Destination modpack id');
  const name = value.name === undefined ? undefined : validateName(value.name, 'Duplicated modpack name');
  return { kind: 'duplicate', rootPath, sourceId, destinationId, name };
}

function resolveOperationInput(
  request: ValidatedOperationStart,
  senderId: number,
  consumeArchiveReference: ArchiveReferenceConsumer,
): OperationInput {
  if (request.kind !== 'import') return request;
  const filePath = consumeArchiveReference(senderId, request.archiveRef);
  return {
    kind: 'import',
    rootPath: request.rootPath,
    filePath,
    destinationId: request.destinationId,
    name: request.name,
  };
}

function validateName(value: unknown, label: string): string {
  const name = requireString(value, label).trim();
  if (!name || name.length > MAX_NAME_LENGTH) throw new Error(`${label} is invalid`);
  return name;
}

function validateVersion(value: unknown, label: string): string {
  const version = requireString(value, label).trim();
  if (!version || version.length > 64) throw new Error(`${label} is invalid`);
  return version;
}

function requirePositiveInteger(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || (value as number) <= 0) throw new Error(`${label} is invalid`);
  return value as number;
}

function requireIdentifier(value: unknown, label: string): string {
  const identifier = requireString(value, label).trim();
  if (!/^[a-zA-Z0-9._-]{1,160}$/.test(identifier)) throw new Error(`${label} is invalid`);
  return identifier;
}

function validatePublicHttpsUrl(value: unknown, label: string): string {
  const raw = requireString(value, label);
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`${label} is invalid`);
  }
  if (url.protocol !== 'https:' || url.username || url.password || !url.hostname || isPrivateHost(url.hostname)) {
    throw new Error(`${label} is invalid`);
  }
  return url.toString();
}

function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === 'localhost' || host === '::1' || host.startsWith('127.') || host.startsWith('10.')
    || host.startsWith('192.168.') || /^172\.(1[6-9]|2\d|3[01])\./.test(host);
}

function validateOperationId(value: unknown): string {
  if (!isOperationId(value)) throw new Error('Operation id is invalid');
  return value;
}

function isOperationId(value: unknown): value is string {
  return typeof value === 'string' && OPERATION_ID_RE.test(value);
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} is invalid`);
  return value;
}

function assertReadable(event: IpcMainInvokeEvent, snapshot: InternalOperationSnapshot, owners: ReadonlyMap<string, number>): void {
  if (isRecoveredTerminal(snapshot)) return;
  assertOwned(event, snapshot.id, owners);
}

function assertOwned(event: IpcMainInvokeEvent, operationId: string, owners: ReadonlyMap<string, number>): void {
  if (owners.get(operationId) !== event.sender.id) throw new Error('Operation is only available to its origin renderer');
}

function isRecoveredTerminal(snapshot: InternalOperationSnapshot): boolean {
  return snapshot.status === 'recovered' || snapshot.status === 'recovery-required';
}

function sendSnapshot(event: IpcMainInvokeEvent, snapshot: InternalOperationSnapshot): void {
  if (!event.sender.isDestroyed()) event.sender.send('operations:update', toPublicSnapshot(snapshot));
}

function toPublicSnapshot(snapshot: InternalOperationSnapshot): OperationSnapshot {
  return {
    id: safeOperationId(snapshot.id),
    kind: safeOperationKind(snapshot.kind),
    status: safeOperationStatus(snapshot.status),
    phase: safeOperationPhase(snapshot.phase),
    progress: sanitizeProgress(snapshot.progress),
    createdAt: safeTimestamp(snapshot.createdAt),
    updatedAt: safeTimestamp(snapshot.updatedAt),
    result: sanitizeResult(snapshot.result),
  };
}

function sanitizeProgress(progress: InternalOperationSnapshot['progress']): OperationSnapshot['progress'] {
  const message = safeProgressMessage(progress.message);
  return {
    completed: safeProgressValue(progress.completed),
    total: safeProgressValue(progress.total),
    ...(message ? { message } : {}),
  };
}

function sanitizeResult(result: unknown): OperationSnapshot['result'] {
  if (!isRecord(result)) return undefined;
  if (result.status === 'failed') return { status: 'failed', code: safeErrorCode(result.code), message: 'Operation failed' };
  if (result.status === 'recovery-required') return { status: 'recovery-required', message: 'Operation recovery requires attention' };
  if (result.status === 'degraded') return {
    status: 'degraded',
    ...(typeof result.instanceId === 'string' ? { instanceId: safeLogicalIdentifier(result.instanceId) } : {}),
    missing: Array.isArray(result.missing) ? result.missing.map(sanitizeMissingItem) : [],
  };
  if (result.status === 'succeeded') return { status: 'succeeded', instanceId: safeLogicalIdentifier(result.instanceId) };
  if (result.status === 'recovered') return {
    status: 'recovered',
    ...(typeof result.instanceId === 'string' ? { instanceId: safeLogicalIdentifier(result.instanceId) } : {}),
  };
  if (result.status === 'cancelled') return { status: 'cancelled' };
  return undefined;
}

function sanitizeMissingItem(item: unknown): import('../../../shared/contracts/operations').OperationMissingItem {
  if (typeof item === 'string') return { path: safeLogicalPath(item), reason: 'optional-item' };
  if (!isRecord(item)) return { path: 'optional-item', reason: 'optional-item' };
  return { path: safeLogicalPath(item.path), reason: safeReason(item.reason) };
}

function safeLogicalIdentifier(value: unknown): string {
  // This field is rendered to every renderer for recovered operations. Accept
  // only a single logical identifier, never a path-like value: prefixes and trimming
  // are insufficient because absolute paths can be embedded after text or
  // control whitespace.
  return typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/.test(value)
    ? value
    : 'optional-item';
}

function safeLogicalPath(value: unknown): string {
  // Missing files may be described by a relative logical path. Each segment is
  // allowlisted independently; separators, whitespace, controls, schemes and
  // drive forms all fail instead of being normalized or partially exposed.
  return typeof value === 'string'
    && value.length <= 240
    && /^(?:[A-Za-z0-9][A-Za-z0-9._-]{0,119})(?:\/[A-Za-z0-9][A-Za-z0-9._-]{0,119})*$/.test(value)
    ? value
    : 'optional-item';
}

function safeReason(value: unknown): string {
  return typeof value === 'string' && /^[a-z0-9_-]{1,64}$/i.test(value) ? value : 'optional-item';
}

function safeErrorCode(code: unknown): string {
  return typeof code === 'string' && /^[A-Z0-9_]{1,64}$/.test(code) ? code : 'OPERATION_FAILED';
}

function safeProgressMessage(value: unknown): string | undefined {
  return typeof value === 'string' && /^[a-z0-9-]{1,64}$/i.test(value) ? value : undefined;
}

function safeProgressValue(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;
}

function safeOperationId(value: unknown): string {
  return typeof value === 'string' && /^(?:recovery-)?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
    ? value
    : 'recovered-operation';
}

function safeOperationKind(value: unknown): OperationSnapshot['kind'] {
  return value === 'duplicate' || value === 'import' || value === 'import-share' || value === 'install-curseforge' || value === 'install-modrinth'
    || value === 'update' || value === 'delete' || value === 'export'
    ? value
    : 'duplicate';
}

function safeOperationStatus(value: unknown): OperationSnapshot['status'] {
  return value === 'queued' || value === 'running' || value === 'cancelling' || value === 'succeeded'
    || value === 'recovered' || value === 'degraded' || value === 'cancelled' || value === 'failed'
    || value === 'recovery-required'
    ? value
    : 'recovery-required';
}

function safeOperationPhase(value: unknown): OperationSnapshot['phase'] {
  return value === 'started' || value === 'staged' || value === 'validated' || value === 'publish-intent'
    || value === 'backup-created' || value === 'published' || value === 'control-plane-committed'
    || value === 'completed' || value === 'failed' || value === 'cancelled' || value === 'recovery-required'
    ? value
    : 'recovery-required';
}

function safeTimestamp(value: unknown): string {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) return '1970-01-01T00:00:00.000Z';
  return new Date(value).toISOString();
}

function subscriptionKey(senderId: number, operationId: string): string {
  return `${senderId}:${operationId}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
