import { createHash } from 'node:crypto';
import type { OperationSnapshot } from './operationTypes';

export function createRecoveryFailureSnapshot(rootPath: string, error: unknown): OperationSnapshot {
  const now = new Date().toISOString();
  const message = error instanceof Error ? error.message : 'Operation failed';
  const failureId = createHash('sha256').update(`${rootPath}\0${message}`).digest('hex').slice(0, 40);
  return {
    id: `recovery-${failureId}`, kind: 'duplicate', rootPath, status: 'recovery-required', phase: 'recovery-required',
    progress: { completed: 0, total: 1 }, createdAt: now, updatedAt: now,
    input: { kind: 'duplicate', rootPath, sourceId: 'recovery' },
    result: { status: 'recovery-required', message },
  };
}
