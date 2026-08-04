// @vitest-environment jsdom

import { act, renderHook, waitFor } from '@testing-library/react';
import type { Dispatch, SetStateAction } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { OperationResult, OperationSnapshot } from '@shared/contracts';
import type { ModpackConfig } from '../../types';
import ipcChannels from '../../../../../shared/contracts/ipcChannels.ts?raw';
import instanceImporterService from '../../../../../electron/services/instances/importer/InstanceImporterService.ts?raw';
import instancesIPC from '../../../../services/ipc/instancesIPC.ts?raw';
import instancesService from '../../services/instancesService.ts?raw';
import crudActions from '../useInstanceCrudActions.ts?raw';
import manualEnvironment from '../../../../verification/manual/mockEnvironment.ts?raw';
import englishContractsMap from '../../../../../docs/en/contracts-map.md?raw';
import russianContractsMap from '../../../../../docs/ru/contracts-map.md?raw';

const mocked = vi.hoisted(() => ({
  create: vi.fn(),
  snapshot: vi.fn(),
  rename: vi.fn(),
  select: vi.fn(),
  start: vi.fn(),
  subscribe: vi.fn(),
}));

vi.mock('../../../../services/ipc/instancesIPC', () => ({
  instancesIPC: {
    create: (...args: unknown[]) => mocked.create(...args),
    snapshot: (...args: unknown[]) => mocked.snapshot(...args),
    rename: (...args: unknown[]) => mocked.rename(...args),
    select: (...args: unknown[]) => mocked.select(...args),
    list: vi.fn(),
    config: vi.fn(),
    metadata: vi.fn(),
    prepare: vi.fn(),
  },
}));

vi.mock('../../../../services/ipc/operationsIPC', () => ({
  operationsIPC: {
    start: mocked.start,
    subscribe: mocked.subscribe,
  },
}));

import { useInstanceCrudActions } from '../useInstanceCrudActions';

type HookResult = ReturnType<typeof useInstanceCrudActions> & {
  duplicateOperation: OperationSnapshot | null;
  deleteOperation: OperationSnapshot | null;
};

const started = snapshot('queued');
describe('useInstanceCrudActions duplicate operation', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    snapshot('running'),
    snapshot('cancelling'),
    snapshot('cancelled', { status: 'cancelled' }),
    snapshot('failed', { status: 'failed', code: 'COPY_FAILED', message: 'Copy failed' }),
    snapshot('degraded', { status: 'degraded', missing: ['optional-item'] }),
    snapshot('recovered', { status: 'recovered' }),
  ])('keeps the typed %s duplicate state in place without optimistic selection or reload', async (nextSnapshot) => {
    const { result, refresh, loadSelected } = renderActions();
    let listener: ((value: OperationSnapshot) => void) | undefined;
    mocked.start.mockResolvedValue(started);
    mocked.subscribe.mockImplementation(async (_operationId: string, nextListener: (value: OperationSnapshot) => void) => {
      listener = nextListener;
      return vi.fn();
    });

    let operation: Promise<void> | undefined;
    act(() => {
      operation = result.current.duplicate('source-pack', 'Copy');
    });

    await waitFor(() => {
      expect(mocked.start).toHaveBeenCalledWith({
        kind: 'duplicate',
        sourceId: 'source-pack',
        name: 'Copy',
      });
      expect(listener).toBeTypeOf('function');
    });

    await act(async () => {
      listener?.(nextSnapshot);
      if (isTerminal(nextSnapshot)) await operation;
    });

    await waitFor(() => expect((result.current as HookResult).duplicateOperation).toEqual(nextSnapshot));
    expect(mocked.select).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
    expect(loadSelected).not.toHaveBeenCalled();
  });

  it.each(['succeeded', 'recovered'] as const)('keeps %s feedback and selects its published instance value', async (status) => {
    const { result } = renderActions();
    let listener: ((value: OperationSnapshot) => void) | undefined;
    mocked.start.mockResolvedValue(started);
    mocked.subscribe.mockImplementation(async (_operationId: string, nextListener: (value: OperationSnapshot) => void) => {
      listener = nextListener;
      return vi.fn();
    });

    let operation: Promise<void> | undefined;
    act(() => {
      operation = result.current.duplicate('source-pack', 'Copy');
    });
    await waitFor(() => expect(listener).toBeTypeOf('function'));

    const completed = publishedSnapshot(status);
    await act(async () => {
      listener?.(completed);
      await operation;
    });

    await waitFor(() => expect((result.current as HookResult).duplicateOperation).toEqual(completed));
    expect(mocked.select).toHaveBeenCalledWith({ id: 'published-pack' });
  });

  it('uses the exact typed operation unsubscribe once when the hook unmounts', async () => {
    const unsubscribe = vi.fn();
    const { result, unmount } = renderActions();
    mocked.start.mockResolvedValue(started);
    mocked.subscribe.mockResolvedValue(unsubscribe);

    act(() => {
      void result.current.duplicate('source-pack', 'Copy');
    });
    await waitFor(() => expect(mocked.subscribe).toHaveBeenCalledWith(started.id, expect.any(Function)));

    unmount();

    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('releases a typed subscription that resolves after unmount', async () => {
    const unsubscribe = vi.fn();
    let resolveSubscription: ((value: () => void) => void) | undefined;
    const { result, unmount } = renderActions();
    mocked.start.mockResolvedValue(started);
    mocked.subscribe.mockImplementation(() => new Promise((resolve) => {
      resolveSubscription = resolve;
    }));

    act(() => {
      void result.current.duplicate('source-pack', 'Copy');
    });
    await waitFor(() => expect(mocked.subscribe).toHaveBeenCalledWith(started.id, expect.any(Function)));

    unmount();
    resolveSubscription?.(unsubscribe);

    await waitFor(() => expect(unsubscribe).toHaveBeenCalledTimes(1));
  });

  it('has no legacy duplicate chain outside the operation adapter', () => {
    expect(findLegacyDuplicateReferences()).toEqual([]);
  });
});

describe('useInstanceCrudActions delete operation', () => {
  afterEach(() => vi.clearAllMocks());

  it.each([
    snapshot('running'),
    snapshot('cancelling'),
    snapshot('cancelled', { status: 'cancelled' }),
    snapshot('failed', { status: 'failed', code: 'DELETE_FAILED', message: 'Delete failed' }),
    snapshot('degraded', { status: 'degraded', missing: [] }),
    snapshot('recovered', { status: 'recovered', instanceId: 'source-pack' }),
    snapshot('succeeded', { status: 'succeeded', instanceId: 'source-pack' }),
  ])('retains %s delete state and refreshes only a committed result', async (nextSnapshot) => {
    const { result, refresh, loadSelected } = renderActions();
    let listener: ((value: OperationSnapshot) => void) | undefined;
    mocked.start.mockResolvedValue(deleteStarted());
    mocked.subscribe.mockImplementation(async (_operationId: string, nextListener: (value: OperationSnapshot) => void) => {
      listener = nextListener;
      return vi.fn();
    });

    let operation: Promise<void> | undefined;
    act(() => { operation = result.current.remove('source-pack'); });
    await waitFor(() => expect(mocked.start).toHaveBeenCalledWith({ kind: 'delete', instanceId: 'source-pack' }));
    await act(async () => { listener?.(nextSnapshot); if (isTerminal(nextSnapshot)) await operation; });

    expect((result.current as HookResult).deleteOperation).toEqual(nextSnapshot);
    if (nextSnapshot.status === 'succeeded' || nextSnapshot.status === 'recovered') {
      expect(refresh).toHaveBeenCalledTimes(1);
      expect(loadSelected).toHaveBeenCalledTimes(1);
    } else {
      expect(refresh).not.toHaveBeenCalled();
      expect(loadSelected).not.toHaveBeenCalled();
    }
  });

  it('has no legacy delete chain outside the operation adapter', () => {
    expect(findLegacyDeleteReferences()).toEqual([]);
  });

  it('uses the exact delete operation unsubscribe once when the hook unmounts', async () => {
    const unsubscribe = vi.fn();
    const { result, unmount } = renderActions();
    mocked.start.mockResolvedValue(deleteStarted());
    mocked.subscribe.mockResolvedValue(unsubscribe);

    act(() => { void result.current.remove('source-pack'); });
    await waitFor(() => expect(mocked.subscribe).toHaveBeenCalledWith(deleteStarted().id, expect.any(Function)));

    unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});

function renderActions() {
  const refresh = vi.fn().mockResolvedValue(undefined);
  const loadSelected = vi.fn().mockResolvedValue(undefined);
  const setConfig = vi.fn() as unknown as Dispatch<SetStateAction<ModpackConfig | null>>;
  const { result, unmount } = renderHook(() => useInstanceCrudActions({
    selectedId: 'source-pack',
    setSelectedId: vi.fn(),
    setConfig,
    refresh,
    loadSelected,
  }));

  mocked.select.mockResolvedValue({ ok: true, value: { status: 'committed', selectedId: 'published-pack', instances: [] } });
  mocked.snapshot.mockResolvedValue({
    ok: true,
    value: {
      id: 'published-pack',
      name: 'Published Pack',
      metadata: { source: 'local', createdAt: '2026-08-03T00:00:00.000Z', updatedAt: '2026-08-03T00:00:00.000Z' },
      config: { runtime: { minecraftVersion: '1.20.1' } },
      summary: { minecraftVersion: '1.20.1' },
    },
  });

  return { result, unmount, refresh, loadSelected };
}

function snapshot(status: OperationSnapshot['status'], result?: OperationResult): OperationSnapshot {
  return {
    ...startedBase(),
    status,
    result,
  };
}

function startedBase(): Omit<OperationSnapshot, 'status' | 'result'> {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    kind: 'duplicate',
    phase: 'started',
    progress: { completed: 0, total: 4 },
    createdAt: '2026-08-03T00:00:00.000Z',
    updatedAt: '2026-08-03T00:00:00.000Z',
  };
}

function isTerminal(snapshot: OperationSnapshot): boolean {
  return ['succeeded', 'recovered', 'degraded', 'cancelled', 'failed', 'recovery-required'].includes(snapshot.status);
}

function findLegacyDuplicateReferences(): string[] {
  const files = {
    'shared/contracts/ipcChannels.ts': ipcChannels,
    'electron/services/instances/importer/InstanceImporterService.ts': instanceImporterService,
    'src/services/ipc/instancesIPC.ts': instancesIPC,
    'src/contexts/instances/services/instancesService.ts': instancesService,
    'src/contexts/instances/hooks/useInstanceCrudActions.ts': crudActions,
    'src/verification/manual/mockEnvironment.ts': manualEnvironment,
    'docs/en/contracts-map.md': englishContractsMap,
    'docs/ru/contracts-map.md': russianContractsMap,
  };
  const legacy = /modpacks:duplicate|\bduplicateModpack\b|operationsIPC\.duplicate/;

  return Object.entries(files).filter(([, source]) => legacy.test(source)).map(([file]) => file);
}

function findLegacyDeleteReferences(): string[] {
  const files = {
    'shared/contracts/ipcChannels.ts': ipcChannels,
    'src/services/ipc/instancesIPC.ts': instancesIPC,
    'src/contexts/instances/services/instancesService.ts': instancesService,
    'src/contexts/instances/hooks/useInstanceCrudActions.ts': crudActions,
    'src/verification/manual/mockEnvironment.ts': manualEnvironment,
    'docs/en/contracts-map.md': englishContractsMap,
    'docs/ru/contracts-map.md': russianContractsMap,
  };
  const legacy = /modpacks:delete|\bdeleteModpack\b|operationsIPC\.remove/;

  return Object.entries(files).filter(([, source]) => legacy.test(source)).map(([file]) => file);
}

function deleteStarted(): OperationSnapshot {
  return { ...startedBase(), kind: 'delete', status: 'queued' };
}

function publishedSnapshot(status: 'succeeded' | 'recovered'): OperationSnapshot {
  return status === 'succeeded'
    ? snapshot(status, { status, instanceId: 'published-pack' })
    : snapshot(status, { status, instanceId: 'published-pack' });
}
