import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
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
  resolveApprovedLauncherRootPath: (value: string) => {
    if (value === 'relative') throw new Error('Operation root path must be absolute');
    return value;
  },
}));

import { registerOperationsHandlers } from '../operationsHandlers';
import {
  authorizeSavePath,
  clearSavePathAuthorizationsForTests,
} from '../../../security/savePathAuthorizations';
import { OperationJournal } from '../../../services/operations/operationJournal';
import { OperationRunner } from '../../../services/operations/operationRunner';

const activeSnapshot = {
  id: '11111111-1111-1111-1111-111111111111',
  kind: 'duplicate' as const,
  rootPath: '/secret/root',
  instanceId: 'source-pack',
  status: 'running' as const,
  phase: 'started' as const,
  progress: { completed: 0, total: 1 },
  createdAt: '2026-08-03T00:00:00.000Z',
  updatedAt: '2026-08-03T00:00:00.000Z',
  input: { kind: 'duplicate' as const, rootPath: '/secret/root', sourceId: 'source-pack' },
};

const recoveredSnapshot = {
  ...activeSnapshot,
  id: '22222222-2222-2222-2222-222222222222',
  status: 'recovered' as const,
  phase: 'completed' as const,
  result: { status: 'recovered' as const },
};

describe('operations IPC security boundary', () => {
  afterEach(() => {
    mocked.handlers.clear();
    mocked.listeners.clear();
    clearSavePathAuthorizationsForTests();
    vi.restoreAllMocks();
  });

  it('rejects malformed operation requests before they reach the runner', async () => {
    const runner = {
      prepareRoot: vi.fn().mockResolvedValue(undefined),
      start: vi.fn(), get: vi.fn(), cancel: vi.fn(), subscribe: vi.fn(), listRecovered: vi.fn(() => []),
    };
    registerOperationsHandlers({ runner: runner as never });
    const start = mocked.handlers.get('operations:start');

    await expect(start?.({ sender: { id: 7 } }, { kind: 'unknown', rootPath: '/root', sourceId: 'source' })).rejects.toThrow(/kind/i);
    await expect(start?.({ sender: { id: 7 } }, { kind: 'duplicate', rootPath: 'relative', sourceId: 'source' })).rejects.toThrow(/root/i);
    await expect(start?.({ sender: { id: 7 } }, { kind: 'duplicate', rootPath: '/root', sourceId: '../escape' })).rejects.toThrow(/source/i);
    await expect(start?.({ sender: { id: 7 } }, { kind: 'import', rootPath: '/root', filePath: 'relative.mrpack' })).rejects.toThrow(/import path/i);
    expect(runner.start).not.toHaveBeenCalled();
  });

  it('keeps active operations sender-scoped while exposing only sanitized recovered terminal records', async () => {
    const runner = {
      prepareRoot: vi.fn().mockResolvedValue(undefined),
      start: vi.fn(() => activeSnapshot),
      get: vi.fn((id: string) => id === '11111111-1111-1111-1111-111111111111' ? activeSnapshot : recoveredSnapshot),
      cancel: vi.fn(() => true),
      subscribe: vi.fn(),
      listRecovered: vi.fn(() => [recoveredSnapshot]),
    };
    registerOperationsHandlers({ runner: runner as never });
    const owner = { sender: { id: 7 } };
    const foreign = { sender: { id: 8 } };
    const start = mocked.handlers.get('operations:start');
    const get = mocked.handlers.get('operations:get');
    const cancel = mocked.handlers.get('operations:cancel');
    const subscribe = mocked.handlers.get('operations:subscribe');
    const listRecovered = mocked.handlers.get('operations:listRecovered');

    await start?.(owner, { kind: 'duplicate', rootPath: '/secret/root', sourceId: 'source-pack' });
    await expect(get?.(foreign, '11111111-1111-1111-1111-111111111111')).rejects.toThrow(/origin renderer/i);
    await expect(cancel?.(foreign, '11111111-1111-1111-1111-111111111111')).rejects.toThrow(/origin renderer/i);
    await expect(subscribe?.(foreign, '11111111-1111-1111-1111-111111111111')).rejects.toThrow(/origin renderer/i);

    await expect(get?.(foreign, '22222222-2222-2222-2222-222222222222')).resolves.toEqual(expect.objectContaining({ id: '22222222-2222-2222-2222-222222222222', status: 'recovered' }));
    await expect(listRecovered?.(foreign)).resolves.toEqual([expect.objectContaining({ id: '22222222-2222-2222-2222-222222222222' })]);
    await expect(cancel?.(foreign, '22222222-2222-2222-2222-222222222222')).resolves.toEqual({ cancelled: false });
    expect(runner.cancel).not.toHaveBeenCalledWith('22222222-2222-2222-2222-222222222222');

    const recovered = await get?.(foreign, '22222222-2222-2222-2222-222222222222') as Record<string, unknown>;
    expect(recovered).not.toHaveProperty('rootPath');
    expect(recovered).not.toHaveProperty('input');
  });

  it('does not expose absolute paths from a recovered journal snapshot', async () => {
    const rootPath = fs.mkdtempSync(path.join(os.tmpdir(), 'fmcl-public-operation-snapshot-'));
    try {
      const journal = new OperationJournal(rootPath);
      journal.save({
        ...recoveredSnapshot,
        rootPath,
        progress: { completed: 1, total: 1, message: '/private/root/operation.log' },
        input: { kind: 'duplicate', rootPath, sourceId: 'source-pack' },
      });
      const runner = new OperationRunner([]);
      await runner.recover(rootPath);
      registerOperationsHandlers({ runner });
      const listRecovered = mocked.handlers.get('operations:listRecovered');

      const [snapshot] = await listRecovered?.({ sender: { id: 8 } }) as Array<Record<string, unknown>>;

      expect(snapshot).toMatchObject({
        status: 'recovered',
        progress: { completed: 1, total: 1 },
      });
      expect(snapshot.progress).not.toHaveProperty('message');
      expect(JSON.stringify(snapshot)).not.toContain('/private/root');
    } finally {
      fs.rmSync(rootPath, { recursive: true, force: true });
    }
  });

  it.each([
    ' /private/root/missing.jar',
    ' C:\\private\\root\\missing.jar',
    ' C:/private/root/missing.jar',
    ' \\\\server\\share\\missing.jar',
    ' //server/share/missing.jar',
    ' file:///private/root/missing.jar',
    ' C:relative-drive-path',
    'label /private/root/missing.jar',
    'x\n/private/root/missing.jar',
    'label\tfile:///private/root/missing.jar',
    'label C:relative-drive-path',
    'label\\private\\root\\missing.jar',
    'mod pack.jar',
  ])('removes absolute and URI-like paths from public missing items: %s', async (missingPath) => {
    const degradedSnapshot = {
      ...activeSnapshot,
      status: 'degraded' as const,
      phase: 'completed' as const,
      result: { status: 'degraded' as const, instanceId: missingPath, missing: [{ path: missingPath, reason: 'download-failed' }] },
    };
    const runner = {
      prepareRoot: vi.fn().mockResolvedValue(undefined),
      start: vi.fn(() => degradedSnapshot),
      get: vi.fn(() => degradedSnapshot),
      cancel: vi.fn(), subscribe: vi.fn(), listRecovered: vi.fn(() => []),
    };
    registerOperationsHandlers({ runner: runner as never });
    const start = mocked.handlers.get('operations:start');

    const snapshot = await start?.({ sender: { id: 7 } }, { kind: 'duplicate', rootPath: '/secret/root', sourceId: 'source-pack' }) as Record<string, unknown>;

    expect(snapshot).toMatchObject({
      result: { status: 'degraded', instanceId: 'optional-item', missing: [{ path: 'optional-item', reason: 'download-failed' }] },
    });
  });

  it('keeps safe relative missing paths while requiring a single-segment instance id', async () => {
    const degradedSnapshot = {
      ...activeSnapshot,
      status: 'degraded' as const,
      phase: 'completed' as const,
      result: { status: 'degraded' as const, instanceId: 'mods/optional.jar', missing: [{ path: 'mods/optional.jar', reason: 'download-failed' }] },
    };
    const runner = {
      prepareRoot: vi.fn().mockResolvedValue(undefined),
      start: vi.fn(() => degradedSnapshot),
      get: vi.fn(() => degradedSnapshot),
      cancel: vi.fn(), subscribe: vi.fn(), listRecovered: vi.fn(() => []),
    };
    registerOperationsHandlers({ runner: runner as never });
    const start = mocked.handlers.get('operations:start');

    const snapshot = await start?.({ sender: { id: 7 } }, { kind: 'duplicate', rootPath: '/secret/root', sourceId: 'source-pack' }) as Record<string, unknown>;

    expect(snapshot).toMatchObject({
      result: { status: 'degraded', instanceId: 'optional-item', missing: [{ path: 'mods/optional.jar', reason: 'download-failed' }] },
    });
  });

  it('consumes the exact sender-bound native save path once before starting an export', async () => {
    const runner = {
      prepareRoot: vi.fn().mockResolvedValue(undefined),
      start: vi.fn(() => ({ ...activeSnapshot, kind: 'export' as const })),
      get: vi.fn(), cancel: vi.fn(), subscribe: vi.fn(), listRecovered: vi.fn(() => []),
    };
    registerOperationsHandlers({ runner: runner as never });
    const start = mocked.handlers.get('operations:start');
    const owner = { sender: { id: 7 } };
    const foreign = { sender: { id: 8 } };
    const outputPath = path.join(os.tmpdir(), 'fmcl-operation-export.zip');
    const request = { kind: 'export', rootPath: '/root', instanceId: 'source-pack', format: 'zip', outputPath };

    await expect(start?.(owner, request)).rejects.toThrow(/not authorized/i);
    expect(runner.start).not.toHaveBeenCalled();

    authorizeSavePath(7, outputPath);
    await expect(start?.(foreign, request)).rejects.toThrow(/not authorized/i);
    expect(runner.start).not.toHaveBeenCalled();

    await expect(start?.(owner, { ...request, outputPath: path.join(os.tmpdir(), 'different-export.zip') })).rejects.toThrow(/not authorized/i);
    expect(runner.start).not.toHaveBeenCalled();

    await expect(start?.(owner, request)).resolves.toEqual(expect.objectContaining({ kind: 'export' }));
    expect(runner.start).toHaveBeenCalledWith({ ...request, outputPath: path.normalize(outputPath) });

    await expect(start?.(owner, request)).rejects.toThrow(/not authorized/i);
    expect(runner.start).toHaveBeenCalledOnce();
  });
});
