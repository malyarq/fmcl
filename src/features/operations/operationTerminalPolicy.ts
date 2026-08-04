import type { OperationKind, OperationSnapshot, OperationStatus } from '@shared/contracts';

const TERMINAL_STATUSES = new Set<OperationStatus>([
  'succeeded',
  'recovered',
  'degraded',
  'cancelled',
  'failed',
  'recovery-required',
]);

const SELECTABLE_INSTANCE_KINDS = new Set<OperationKind>([
  'duplicate',
  'import',
  'import-share',
  'install-curseforge',
  'install-modrinth',
]);

const COMMITTED_DEGRADED_KINDS = new Set<OperationKind>([
  'import',
  'import-share',
  'install-curseforge',
  'install-modrinth',
]);

export type OperationTerminalClassification = {
  isTerminal: boolean;
  didCommit: boolean;
  shouldInvalidateInstances: boolean;
  isPresentationSuccess: boolean;
  selectableInstanceId: string | undefined;
  mayCloseSurface: boolean;
};

const EMPTY_CLASSIFICATION: OperationTerminalClassification = {
  isTerminal: false,
  didCommit: false,
  shouldInvalidateInstances: false,
  isPresentationSuccess: false,
  selectableInstanceId: undefined,
  mayCloseSurface: false,
};

/**
 * Classifies only evidence present in the public operation snapshot. In
 * particular, a degraded operation may have committed data without being a UI
 * success. Callers must not infer publication from progress or a terminal phase.
 */
export function classifyOperationTerminal(
  snapshot: OperationSnapshot,
): OperationTerminalClassification {
  if (!TERMINAL_STATUSES.has(snapshot.status)) {
    return EMPTY_CLASSIFICATION;
  }

  const terminalFailure: OperationTerminalClassification = {
    ...EMPTY_CLASSIFICATION,
    isTerminal: true,
  };

  if (snapshot.status === 'failed'
    || snapshot.status === 'cancelled'
    || snapshot.status === 'recovery-required') {
    return terminalFailure;
  }

  if (snapshot.status === 'degraded') {
    const result = snapshot.result;
    const didCommit = snapshot.phase === 'completed'
      && result?.status === 'degraded'
      && COMMITTED_DEGRADED_KINDS.has(snapshot.kind)
      && Boolean(result.instanceId?.trim());

    return didCommit
      ? {
          isTerminal: true,
          didCommit: true,
          shouldInvalidateInstances: true,
          isPresentationSuccess: false,
          selectableInstanceId: undefined,
          mayCloseSurface: false,
        }
      : terminalFailure;
  }

  if (snapshot.result?.status !== snapshot.status) {
    return terminalFailure;
  }

  const instanceId = snapshot.result.instanceId?.trim() || undefined;
  return {
    isTerminal: true,
    didCommit: true,
    shouldInvalidateInstances: snapshot.kind !== 'export',
    isPresentationSuccess: true,
    selectableInstanceId: SELECTABLE_INSTANCE_KINDS.has(snapshot.kind) ? instanceId : undefined,
    mayCloseSurface: true,
  };
}

export function isOperationTerminal(snapshot: OperationSnapshot): boolean {
  return TERMINAL_STATUSES.has(snapshot.status);
}
