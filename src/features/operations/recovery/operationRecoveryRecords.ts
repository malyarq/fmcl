import type { OperationKind, OperationPhase, OperationSnapshot } from '@shared/contracts';

const OPERATION_KINDS = new Set<OperationKind>([
  'duplicate', 'import', 'import-share', 'install-curseforge',
  'install-modrinth', 'update', 'delete', 'export',
]);
const OPERATION_PHASES = new Set<OperationPhase>([
  'started', 'staged', 'validated', 'publish-intent', 'backup-created',
  'published', 'control-plane-committed', 'completed', 'failed',
  'cancelled', 'recovery-required',
]);
const OPERATION_ID_PATTERN = /^[A-Za-z0-9._:-]{1,160}$/;
const DISMISSED_RECOVERY_KEY = 'operations_dismissedRecoveryV1';
const MAX_DISMISSED_RECOVERY_IDS = 200;

export function readDismissedRecoveryIds(): Set<string> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(DISMISSED_RECOVERY_KEY) ?? '[]');
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter(isOperationId).slice(-MAX_DISMISSED_RECOVERY_IDS));
  } catch {
    return new Set();
  }
}

export function rememberDismissedRecoveryId(current: ReadonlySet<string>, operationId: string): Set<string> {
  if (!OPERATION_ID_PATTERN.test(operationId)) return new Set(current);
  const retained = [...[...current].filter((id) => id !== operationId), operationId]
    .slice(-MAX_DISMISSED_RECOVERY_IDS);
  try {
    localStorage.setItem(DISMISSED_RECOVERY_KEY, JSON.stringify(retained));
  } catch {
    // Current-session dismissal still works when storage is unavailable.
  }
  return new Set(retained);
}

export function normalizeRecoverySnapshots(values: unknown) {
  if (!Array.isArray(values)) throw new Error('The recovery journal returned an invalid result');
  const byId = new Map<string, OperationSnapshot>();
  for (const snapshot of values.filter(isRecoverySnapshot)) byId.set(snapshot.id, snapshot);
  return [...byId.values()].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export function isRecoverySnapshot(value: unknown): value is OperationSnapshot {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const snapshot = value as Partial<OperationSnapshot>;
  return hasValidIdentity(snapshot) && hasValidTerminalState(snapshot) && hasValidProgress(snapshot);
}

function hasValidIdentity(snapshot: Partial<OperationSnapshot>): boolean {
  if (!isOperationId(snapshot.id)) return false;
  if (typeof snapshot.kind !== 'string' || !OPERATION_KINDS.has(snapshot.kind as OperationKind)) return false;
  if (typeof snapshot.phase !== 'string' || !OPERATION_PHASES.has(snapshot.phase as OperationPhase)) return false;
  if (typeof snapshot.createdAt !== 'string' || typeof snapshot.updatedAt !== 'string') return false;
  return Number.isFinite(Date.parse(snapshot.createdAt)) && Number.isFinite(Date.parse(snapshot.updatedAt));
}

function hasValidTerminalState(snapshot: Partial<OperationSnapshot>): boolean {
  if (snapshot.status !== 'recovered' && snapshot.status !== 'recovery-required') return false;
  if (snapshot.result?.status !== snapshot.status) return false;
  if ((snapshot.status === 'recovered' && snapshot.phase !== 'completed')
    || (snapshot.status === 'recovery-required' && snapshot.phase !== 'recovery-required')) return false;
  return true;
}

function hasValidProgress(snapshot: Partial<OperationSnapshot>): boolean {
  const progress = snapshot.progress;
  if (!progress) return false;
  if (typeof progress.completed !== 'number' || !Number.isFinite(progress.completed)) return false;
  if (progress.completed < 0) return false;
  if (typeof progress.total !== 'number' || !Number.isFinite(progress.total)) return false;
  return progress.total >= 0;
}

export function replaceRecoveryRecord(records: readonly OperationSnapshot[], next: OperationSnapshot) {
  const updated = records.map((current) => current.id === next.id ? next : current);
  return updated.some(({ id }) => id === next.id) ? updated : [next, ...updated];
}

function isOperationId(value: unknown): value is string {
  return typeof value === 'string' && OPERATION_ID_PATTERN.test(value);
}
