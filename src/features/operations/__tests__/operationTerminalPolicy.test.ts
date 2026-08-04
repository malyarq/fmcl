import { describe, expect, it } from 'vitest';
import type {
  OperationKind,
  OperationPhase,
  OperationResult,
  OperationSnapshot,
  OperationStatus,
} from '@shared/contracts';
import { classifyOperationTerminal } from '../operationTerminalPolicy';

const operationKinds: OperationKind[] = [
  'duplicate',
  'import',
  'import-share',
  'install-curseforge',
  'install-modrinth',
  'update',
  'delete',
  'export',
];

const selectableKinds = new Set<OperationKind>([
  'duplicate',
  'import',
  'import-share',
  'install-curseforge',
  'install-modrinth',
]);

function snapshot({
  kind = 'import',
  status = 'running',
  phase = 'started',
  result,
}: {
  kind?: OperationKind;
  status?: OperationStatus;
  phase?: OperationPhase;
  result?: OperationResult;
} = {}): OperationSnapshot {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    kind,
    status,
    phase,
    progress: { completed: status === 'running' ? 0 : 1, total: 1 },
    createdAt: '2026-08-04T00:00:00.000Z',
    updatedAt: '2026-08-04T00:00:01.000Z',
    result,
  };
}

describe('classifyOperationTerminal', () => {
  it.each(['succeeded', 'recovered'] as const)(
    'classifies matching %s results for every real operation kind',
    (status) => {
      for (const kind of operationKinds) {
        const result: OperationResult = status === 'succeeded'
          ? { status, instanceId: 'published-instance' }
          : { status, instanceId: 'published-instance' };

        expect(classifyOperationTerminal(snapshot({ kind, status, phase: 'completed', result }))).toEqual({
          isTerminal: true,
          didCommit: true,
          shouldInvalidateInstances: kind !== 'export',
          isPresentationSuccess: true,
          selectableInstanceId: selectableKinds.has(kind) ? 'published-instance' : undefined,
          mayCloseSurface: true,
        });
      }
    },
  );

  it.each([
    ['failed', { status: 'failed', code: 'FAILED', message: 'Failed' }, 'failed'],
    ['cancelled', { status: 'cancelled' }, 'cancelled'],
    ['recovery-required', { status: 'recovery-required', message: 'Repair required' }, 'recovery-required'],
  ] as const)('never treats %s as a durable or presentation success', (status, result, phase) => {
    for (const kind of operationKinds) {
      expect(classifyOperationTerminal(snapshot({ kind, status, phase, result }))).toEqual({
        isTerminal: true,
        didCommit: false,
        shouldInvalidateInstances: false,
        isPresentationSuccess: false,
        selectableInstanceId: undefined,
        mayCloseSurface: false,
      });
    }
  });

  it.each(['import', 'import-share', 'install-curseforge', 'install-modrinth'] as const)(
    'accepts completed degraded %s publication only as a committed mutation',
    (kind) => {
      expect(classifyOperationTerminal(snapshot({
        kind,
        status: 'degraded',
        phase: 'completed',
        result: { status: 'degraded', instanceId: 'partial-instance', missing: ['optional.jar'] },
      }))).toEqual({
        isTerminal: true,
        didCommit: true,
        shouldInvalidateInstances: true,
        isPresentationSuccess: false,
        selectableInstanceId: undefined,
        mayCloseSurface: false,
      });
    },
  );

  it.each(['duplicate', 'update', 'delete', 'export'] as const)(
    'rejects degraded %s as a committed mutation',
    (kind) => {
      expect(classifyOperationTerminal(snapshot({
        kind,
        status: 'degraded',
        phase: 'completed',
        result: { status: 'degraded', instanceId: 'partial-instance', missing: [] },
      }))).toMatchObject({
        isTerminal: true,
        didCommit: false,
        shouldInvalidateInstances: false,
        isPresentationSuccess: false,
        selectableInstanceId: undefined,
        mayCloseSurface: false,
      });
    },
  );

  it.each([
    snapshot({ status: 'degraded', phase: 'completed', result: { status: 'degraded', missing: [] } }),
    snapshot({ status: 'degraded', phase: 'published', result: { status: 'degraded', instanceId: 'partial', missing: [] } }),
    snapshot({ status: 'degraded', phase: 'completed', result: { status: 'recovered', instanceId: 'partial' } }),
    snapshot({ status: 'succeeded', phase: 'completed', result: { status: 'recovered', instanceId: 'partial' } }),
    snapshot({ status: 'recovered', phase: 'completed', result: { status: 'succeeded', instanceId: 'partial' } }),
  ])('rejects missing publication proof or mismatched status/result', (value) => {
    expect(classifyOperationTerminal(value)).toMatchObject({
      isTerminal: true,
      didCommit: false,
      shouldInvalidateInstances: false,
      isPresentationSuccess: false,
      mayCloseSurface: false,
    });
  });

  it.each(['queued', 'running', 'cancelling'] as const)('keeps %s non-terminal', (status) => {
    expect(classifyOperationTerminal(snapshot({ status }))).toEqual({
      isTerminal: false,
      didCommit: false,
      shouldInvalidateInstances: false,
      isPresentationSuccess: false,
      selectableInstanceId: undefined,
      mayCloseSurface: false,
    });
  });
});
