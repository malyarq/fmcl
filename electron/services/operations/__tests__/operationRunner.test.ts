import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OperationRunner } from '../operationRunner';
import { createDuplicateOperationAdapter } from '../duplicateOperation';
import { OperationJournal } from '../operationJournal';
import type { InstanceCommand } from '../../../domains/instances/instanceTypes';

describe('OperationRunner', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
  });

  it('assigns a stable serializable id and exposes a truthful terminal snapshot', async () => {
    const rootPath = fs.mkdtempSync(path.join(os.tmpdir(), 'fmcl-operation-runner-'));
    tempDirs.push(rootPath);
    seed(rootPath);
    const runner = new OperationRunner([createDuplicateOperationAdapter()], { rootMutationCoordinator: coordinator() });

    const started = runner.start({ kind: 'duplicate', rootPath, sourceId: 'source', name: 'Copy' });
    expect(started).toMatchObject({ kind: 'duplicate', status: 'queued', phase: 'started' });
    expect(started.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(JSON.parse(JSON.stringify(started))).toEqual(started);

    const completed = await runner.waitFor(started.id);
    expect(completed).toMatchObject({
      id: started.id,
      status: 'succeeded',
      phase: 'completed',
      result: { status: 'succeeded' },
    });
    expect(runner.get(started.id)).toEqual(completed);
  });

  it('rescans the durable journal under every writer acquisition', async () => {
    const rootPath = fs.mkdtempSync(path.join(os.tmpdir(), 'fmcl-operation-rescan-'));
    tempDirs.push(rootPath);
    seed(rootPath);
    const list = vi.spyOn(OperationJournal.prototype, 'list');
    const runner = new OperationRunner([createDuplicateOperationAdapter()]);
    const first = runner.start({ kind: 'duplicate', rootPath, sourceId: 'source', destinationId: 'copy-a' });
    await runner.waitFor(first.id);
    const second = runner.start({ kind: 'duplicate', rootPath, sourceId: 'source', destinationId: 'copy-b' });
    await runner.waitFor(second.id);
    expect(list).toHaveBeenCalledTimes(2);
  });

  it('keeps queued cancellation memory-only until the root writer lock is acquired', async () => {
    const rootPath = fs.mkdtempSync(path.join(os.tmpdir(), 'fmcl-operation-queued-cancel-'));
    tempDirs.push(rootPath);
    let release: (() => void) | undefined;
    const hold = new Promise<void>((resolve) => { release = resolve; });
    const runner = new OperationRunner([{ kind: 'duplicate', run: async () => { await hold; return { status: 'succeeded', instanceId: 'first' }; } }]);
    const first = runner.start({ kind: 'duplicate', rootPath, sourceId: 'source' });
    await vi.waitFor(() => expect(runner.get(first.id)?.status).toBe('running'));
    const queued = runner.start({ kind: 'duplicate', rootPath, sourceId: 'source' });
    expect(runner.cancel(queued.id)).toBe(true);
    expect(new OperationJournal(rootPath).list().find((record) => record.id === queued.id)).toBeUndefined();
    release?.();
    await expect(runner.waitFor(queued.id)).resolves.toMatchObject({ status: 'cancelled' });
    expect(new OperationJournal(rootPath).get(queued.id)).toMatchObject({ status: 'cancelled' });
  });
});

function seed(rootPath: string): void {
  fs.mkdirSync(path.join(rootPath, 'modpacks', 'source'), { recursive: true });
  fs.writeFileSync(path.join(rootPath, 'modpacks', 'source', 'payload.txt'), 'source bytes');
  fs.writeFileSync(path.join(rootPath, 'modpacks', 'source', 'modpack.json'), JSON.stringify({
    id: 'source', name: 'Source', runtime: { minecraft: '1.20.1', modLoader: { type: 'vanilla' } }, memory: { maxMb: 4096 }, vmOptions: [],
  }));
  fs.writeFileSync(path.join(rootPath, 'modpacks.json'), JSON.stringify({
    selectedModpack: 'source', modpacks: { source: { name: 'Source' } },
  }));
  fs.writeFileSync(path.join(rootPath, 'modpacks-metadata.json'), JSON.stringify({
    selectedModpack: 'source', modpacks: {},
  }));
}

function coordinator() {
  const record = {
    id: 'source',
    name: 'Source',
    source: { source: 'local' as const, createdAt: '2026-08-04T00:00:00.000Z', updatedAt: '2026-08-04T00:00:00.000Z' },
    config: { runtime: { minecraftVersion: '1.20.1', modLoader: { type: 'vanilla' as const } } },
    summary: { minecraftVersion: '1.20.1', modLoader: { type: 'vanilla' as const } },
  };
  return {
    forRoot: () => ({
      read: async () => ({ status: 'ready' as const, snapshot: { selectedId: record.id, records: [record] } }),
      prepare: async () => ({ status: 'ready' as const, source: 'canonical' as const, snapshot: { selectedId: record.id, records: [record] } }),
      execute: async (command: InstanceCommand) => ({
        status: 'committed' as const,
        snapshot: command.type === 'commit-published'
          ? { selectedId: command.record.id, records: [record, command.record] }
          : { selectedId: record.id, records: [record] },
      }),
    }),
  };
}
