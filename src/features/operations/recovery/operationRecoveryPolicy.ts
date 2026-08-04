import type { OperationKind } from '@shared/contracts';

/**
 * Startup recovery may navigate only to a safe top-level surface. Export is
 * excluded because its one-time native save authorization cannot be replayed.
 */
export function getOperationRecoveryDestination(kind: OperationKind): 'modpacks' | null {
  return kind === 'export' ? null : 'modpacks';
}
