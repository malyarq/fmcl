import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApplicationLifecycle } from '../applicationLifecycle';
import { OperationJournal } from '../../services/operations/operationJournal';
import { OperationRunner } from '../../services/operations/operationRunner';

describe('application lifecycle fault matrix', () => {
  const roots: string[] = [];

  afterEach(() => {
    for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
  });

  it('closes admission, drains an admitted operation once, and preserves terminal recovery truth through partial cleanup', async () => {
    const rootPath = fs.mkdtempSync(path.join(os.tmpdir(), 'burrow-lifecycle-fault-'));
    roots.push(rootPath);
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const runner = new OperationRunner([{
      kind: 'duplicate',
      async run(context) {
        context.transition('staged');
        await gate;
        return context.isCancelled() ? { status: 'cancelled' } : { status: 'succeeded', instanceId: 'copy' };
      },
    }]);
    const operation = runner.start({ kind: 'duplicate', rootPath, sourceId: 'source' });
    await vi.waitFor(() => expect(runner.get(operation.id)?.phase).toBe('staged'));
    const destroyTray = vi.fn(() => { throw new Error('tray cleanup failed'); });
    const lifecycle = new ApplicationLifecycle({
      unregisterIpc: () => undefined,
      shutdownComposition: async () => {
        const drain = runner.beginShutdown();
        expect(() => runner.start({ kind: 'duplicate', rootPath, sourceId: 'late' })).toThrow('shutting down');
        release?.();
        await drain;
        return { failures: [{ owner: 'lan-discovery', message: 'partial startup cleanup failed' }] };
      },
      stopAuthServer: async () => undefined,
      destroyTray,
    });

    await expect(lifecycle.shutdown()).resolves.toMatchObject({
      composition: { failures: [{ owner: 'lan-discovery', message: 'partial startup cleanup failed' }] },
      failures: [{ owner: 'tray', message: 'tray cleanup failed' }],
    });
    await expect(runner.waitFor(operation.id)).resolves.toMatchObject({ status: 'cancelled' });
    expect(new OperationJournal(rootPath).get(operation.id)).toMatchObject({ status: 'cancelled', phase: 'cancelled' });
    expect(destroyTray).toHaveBeenCalledOnce();
  });
});
