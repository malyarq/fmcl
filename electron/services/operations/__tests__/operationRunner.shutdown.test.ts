import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OperationJournal } from '../operationJournal';
import { OperationRunner } from '../operationRunner';

describe('OperationRunner shutdown', () => {
  const tempDirectories: string[] = [];
  afterEach(() => tempDirectories.splice(0).forEach((directory) => fs.rmSync(directory, { recursive: true, force: true })));

  it('closes admission, requests cancellation and drains durable terminal state', async () => {
    const rootPath = fs.mkdtempSync(path.join(os.tmpdir(), 'fmcl-operation-shutdown-'));
    tempDirectories.push(rootPath);
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const runner = new OperationRunner([{
      kind: 'duplicate',
      run: async (context) => {
        context.transition('staged');
        await gate;
        return context.isCancelled() ? { status: 'cancelled' } : { status: 'succeeded', instanceId: 'copy' };
      },
    }]);
    const started = runner.start({ kind: 'duplicate', rootPath, sourceId: 'source' });
    await vi.waitFor(() => expect(runner.get(started.id)?.status).toBe('running'));

    const drain = runner.beginShutdown();
    expect(runner.isShuttingDown).toBe(true);
    expect(runner.get(started.id)?.status).toBe('cancelling');
    expect(() => runner.start({ kind: 'duplicate', rootPath, sourceId: 'other' })).toThrow('shutting down');
    release?.();
    await drain;

    expect(runner.get(started.id)?.status).toBe('cancelled');
    expect(new OperationJournal(rootPath).get(started.id)).toMatchObject({ status: 'cancelled' });
  });

  it('returns one idempotent drain promise', async () => {
    const runner = new OperationRunner([]);
    expect(runner.beginShutdown()).toBe(runner.beginShutdown());
    await runner.beginShutdown();
  });
});
