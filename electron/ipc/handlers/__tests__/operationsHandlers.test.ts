import { afterEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => ({
  handlers: new Map<string, (...args: unknown[]) => unknown>(),
  listeners: new Map<string, (...args: unknown[]) => unknown>(),
}));

vi.mock('electron', () => ({
  ipcMain: {
    removeHandler: (channel: string) => mocked.handlers.delete(channel),
    handle: (channel: string, handler: (...args: unknown[]) => unknown) => {
      mocked.handlers.set(channel, handler);
    },
    removeAllListeners: (channel: string) => mocked.listeners.delete(channel),
    on: (channel: string, listener: (...args: unknown[]) => unknown) => {
      mocked.listeners.set(channel, listener);
    },
  },
}));

vi.mock('../../../services/instances/paths', () => ({
  resolveApprovedLauncherRootPath: () => '/approved/root',
}));

import { registerOperationsHandlers } from '../operationsHandlers';

const activeSnapshot = {
  id: '11111111-1111-1111-1111-111111111111',
  kind: 'duplicate' as const,
  rootPath: '/private/root',
  instanceId: 'source-pack',
  status: 'running' as const,
  phase: 'started' as const,
  progress: { completed: 0, total: 1 },
  createdAt: '2026-08-03T00:00:00.000Z',
  updatedAt: '2026-08-03T00:00:00.000Z',
  input: { kind: 'duplicate' as const, rootPath: '/private/root', sourceId: 'source-pack' },
};

describe('operations IPC handlers', () => {
  afterEach(() => {
    mocked.handlers.clear();
    mocked.listeners.clear();
    vi.restoreAllMocks();
  });

  it('starts typed operations and delivers sender-bound snapshot updates', async () => {
    const unsubscribe = vi.fn();
    const subscribeToRunner = vi.fn();
    const runner = {
      prepareRoot: vi.fn().mockResolvedValue(undefined),
      start: vi.fn(() => activeSnapshot),
      get: vi.fn(() => activeSnapshot),
      cancel: vi.fn(() => true),
      subscribe: subscribeToRunner.mockReturnValue(unsubscribe),
      listRecovered: vi.fn(() => []),
    };
    const sender = { id: 7, isDestroyed: () => false, send: vi.fn() };
    const consumeArchiveReference = vi.fn((ownerId: number, reference: string) => {
      if (ownerId !== 7 || reference !== 'archive-ref') throw new Error('Archive reference was not authorized');
      return '/private/imports/alpha.mrpack';
    });
    registerOperationsHandlers({ runner: runner as never, consumeArchiveReference });

    const start = mocked.handlers.get('operations:start');
    const subscribe = mocked.handlers.get('operations:subscribe');
    expect(start).toBeTypeOf('function');
    expect(subscribe).toBeTypeOf('function');

    await expect(start?.({ sender }, {
      kind: 'duplicate',
      sourceId: 'source-pack',
      destinationId: 'destination-pack',
      name: 'Destination',
    })).resolves.toMatchObject({ id: '11111111-1111-1111-1111-111111111111', kind: 'duplicate', status: 'running' });
    expect(runner.start).toHaveBeenCalledWith({
      kind: 'duplicate',
      rootPath: '/approved/root',
      sourceId: 'source-pack',
      destinationId: 'destination-pack',
      name: 'Destination',
    });

    await expect(start?.({ sender }, {
      kind: 'import',
      archiveRef: 'archive-ref',
      destinationId: 'imported-pack',
      name: 'Imported Pack',
    })).resolves.toMatchObject({ id: '11111111-1111-1111-1111-111111111111' });
    expect(runner.start).toHaveBeenLastCalledWith({
      kind: 'import',
      rootPath: '/approved/root',
      filePath: '/private/imports/alpha.mrpack',
      destinationId: 'imported-pack',
      name: 'Imported Pack',
    });
    expect(consumeArchiveReference).toHaveBeenCalledWith(7, 'archive-ref');
    expect(consumeArchiveReference.mock.invocationCallOrder[0]).toBeGreaterThan(runner.prepareRoot.mock.invocationCallOrder[1]);
    expect(consumeArchiveReference.mock.invocationCallOrder[0]).toBeLessThan(runner.start.mock.invocationCallOrder[1]);

    await expect(subscribe?.({ sender }, '11111111-1111-1111-1111-111111111111')).resolves.toEqual({ ok: true });
    const onUpdate = subscribeToRunner.mock.calls[0]?.[1] as (snapshot: typeof activeSnapshot) => void;
    onUpdate(activeSnapshot);
    expect(sender.send).toHaveBeenCalledWith('operations:update', expect.objectContaining({ id: '11111111-1111-1111-1111-111111111111' }));

    mocked.listeners.get('operations:unsubscribe')?.({ sender }, '11111111-1111-1111-1111-111111111111');
    expect(unsubscribe).toHaveBeenCalledOnce();
  });
});
