import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDeleteOperationAdapter } from '../deleteOperation';
import { OperationRunner } from '../operationRunner';
import { OperationJournal } from '../operationJournal';
import type { InstanceCommand } from '../../../domains/instances/instanceTypes';

describe('delete operation', () => {
  const tempDirs: string[] = [];
  afterEach(() => { for (const dir of tempDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true }); });

  it('quarantines the instance, commits both control-plane files, then removes only the contained quarantine', async () => {
    const rootPath = makeRoot(tempDirs);
    const { runner, execute } = createRunner();

    const started = runner.start({ kind: 'delete', rootPath, instanceId: 'target' });
    await expect(runner.waitFor(started.id)).resolves.toMatchObject({
      kind: 'delete',
      status: 'succeeded',
      result: { status: 'succeeded', instanceId: 'target' },
    });

    expect(fs.existsSync(path.join(rootPath, 'modpacks', 'target'))).toBe(false);
    expect(fs.existsSync(path.join(rootPath, '.fmcl-operations', 'backups', started.id))).toBe(false);
    expect(execute).toHaveBeenCalledWith({ version: 1, type: 'delete', id: 'target' });
  });

  it.each(['quarantine', 'index', 'metadata'] as const)('restores bytes and control-plane files when %s fails before commit', async (fault) => {
    const rootPath = makeRoot(tempDirs);
    const before = capture(rootPath);
    const { runner } = createRunner({ faults: { [fault]: () => { throw new Error(`${fault} failed`); } } });

    const started = runner.start({ kind: 'delete', rootPath, instanceId: 'target' });
    await expect(runner.waitFor(started.id)).resolves.toMatchObject({ status: 'failed', result: { status: 'failed' } });

    expect(capture(rootPath)).toEqual(before);
    expect(fs.existsSync(path.join(rootPath, '.fmcl-operations', 'backups', started.id))).toBe(false);
  });

  it('restores the quarantined directory when cancellation arrives before the control-plane commit', async () => {
    const rootPath = makeRoot(tempDirs);
    const before = capture(rootPath);
    let cancel: (() => boolean) | undefined;
    const { runner } = createRunner({ hooks: {
      afterQuarantine: () => { cancel?.(); },
    } });
    const started = runner.start({ kind: 'delete', rootPath, instanceId: 'target' });
    cancel = () => runner.cancel(started.id);

    await expect(runner.waitFor(started.id)).resolves.toMatchObject({ status: 'cancelled', result: { status: 'cancelled' } });
    expect(capture(rootPath)).toEqual(before);
  });

  it('keeps the contained quarantine as recovery-required when cleanup fails after control-plane commit', async () => {
    const rootPath = makeRoot(tempDirs);
    const { runner } = createRunner({ faults: {
      cleanup: () => { throw new Error('cleanup failed'); },
    } });

    const started = runner.start({ kind: 'delete', rootPath, instanceId: 'target' });
    await expect(runner.waitFor(started.id)).resolves.toMatchObject({ status: 'recovery-required', result: { status: 'recovery-required' } });

    expect(fs.existsSync(path.join(rootPath, 'modpacks', 'target'))).toBe(false);
    expect(fs.readFileSync(path.join(rootPath, '.fmcl-operations', 'backups', started.id, 'modpacks', 'target', 'payload.bin'))).toEqual(Buffer.from([0, 1, 2, 255]));
  });

  it('serializes same-instance deletes while the first operation is quarantined', async () => {
    const rootPath = makeRoot(tempDirs);
    let release: (() => void) | undefined;
    const waitForRelease = new Promise<void>((resolve) => { release = resolve; });
    let quarantined: (() => void) | undefined;
    const firstQuarantined = new Promise<void>((resolve) => { quarantined = resolve; });
    let calls = 0;
    const { runner } = createRunner({ hooks: {
      afterQuarantine: async () => {
        calls += 1;
        quarantined?.();
        if (calls === 1) await waitForRelease;
      },
    } });

    const first = runner.start({ kind: 'delete', rootPath, instanceId: 'target' });
    const second = runner.start({ kind: 'delete', rootPath, instanceId: 'target' });
    await firstQuarantined;

    expect(runner.get(second.id)).toMatchObject({ status: 'queued' });
    release?.();
    await expect(runner.waitFor(first.id)).resolves.toMatchObject({ status: 'succeeded' });
    await expect(runner.waitFor(second.id)).resolves.toMatchObject({ status: 'failed' });
  });

  it('persists an idempotent canonical delete command before quarantine', async () => {
    const rootPath = makeRoot(tempDirs);
    let recorded: unknown;
    const { runner } = createRunner({ faults: {
      index: () => {
        recorded = new OperationJournal(rootPath).get(started.id)?.recovery?.canonicalCommand;
        throw new Error('simulated control-plane failure');
      },
    } });
    const started = runner.start({ kind: 'delete', rootPath, instanceId: 'target' });

    await expect(runner.waitFor(started.id)).resolves.toMatchObject({ status: 'failed' });
    expect(recorded).toEqual({
      version: 1,
      rootPath,
      operationId: started.id,
      command: { version: 1, type: 'delete', id: 'target' },
    });
  });

  it('recovers an already-absent canonical delete as one exact no-op', async () => {
    const rootPath = makeRoot(tempDirs);
    const operationId = '11111111-1111-4111-8111-111111111111';
    const now = new Date().toISOString();
    new OperationJournal(rootPath).save({
      id: operationId,
      kind: 'delete',
      rootPath,
      instanceId: 'target',
      status: 'running',
      phase: 'published',
      progress: { completed: 1, total: 3 },
      createdAt: now,
      updatedAt: now,
      input: { kind: 'delete', rootPath, instanceId: 'target' },
      recovery: {
        destinationId: 'target',
        canonicalCommand: { version: 1, rootPath, operationId, command: { version: 1, type: 'delete', id: 'target' } },
      },
    });
    const execute = vi.fn(async () => ({ status: 'noop' as const, snapshot: { selectedId: 'source', records: [record('source', 'Source')] } }));
    const runner = new OperationRunner([createDeleteOperationAdapter()], {
      rootMutationCoordinator: {
        forRoot: () => ({
          read: async () => ({ status: 'ready' as const, snapshot: { selectedId: 'source', records: [record('source', 'Source')] } }),
          prepare: async () => ({ status: 'ready' as const, source: 'canonical' as const, snapshot: { selectedId: 'source', records: [record('source', 'Source')] } }),
          execute,
        }),
      },
    });

    await runner.recover(rootPath);
    await runner.recover(rootPath);

    expect(execute).toHaveBeenCalledTimes(1);
    expect(runner.get(operationId)).toMatchObject({ status: 'recovered', result: { status: 'recovered', instanceId: 'target' } });
  });
});

function createRunner(options: Parameters<typeof createDeleteOperationAdapter>[0] = {}) {
  const execute = vi.fn(async (command: InstanceCommand) => ({
    status: 'committed' as const,
    snapshot: command.type === 'delete'
      ? { selectedId: 'source', records: [record('source', 'Source')] }
      : { selectedId: 'target', records: [record('source', 'Source'), record('target', 'Target')] },
  }));
  const snapshot = { selectedId: 'target' as const, records: [record('source', 'Source'), record('target', 'Target')] };
  return {
    execute,
    runner: new OperationRunner([createDeleteOperationAdapter(options)], {
      rootMutationCoordinator: {
        forRoot: () => ({
          read: async () => ({ status: 'ready' as const, snapshot }),
          prepare: async () => ({ status: 'ready' as const, source: 'canonical' as const, snapshot }),
          execute,
        }),
      },
    }),
  };
}

function record(id: string, name: string) {
  return {
    id,
    name,
    source: { source: 'local' as const, createdAt: '2026-08-04T00:00:00.000Z', updatedAt: '2026-08-04T00:00:00.000Z' },
    config: { runtime: { minecraftVersion: '1.20.1', modLoader: { type: 'vanilla' as const } } },
    summary: { minecraftVersion: '1.20.1', modLoader: { type: 'vanilla' as const } },
  };
}

function makeRoot(tempDirs: string[]): string {
  const rootPath = fs.mkdtempSync(path.join(os.tmpdir(), 'burrow-delete-operation-'));
  tempDirs.push(rootPath);
  fs.mkdirSync(path.join(rootPath, 'modpacks', 'source'), { recursive: true });
  fs.mkdirSync(path.join(rootPath, 'modpacks', 'target'), { recursive: true });
  fs.writeFileSync(path.join(rootPath, 'modpacks', 'source', 'modpack.json'), JSON.stringify(config('source', 'Source')));
  fs.writeFileSync(path.join(rootPath, 'modpacks', 'target', 'modpack.json'), JSON.stringify(config('target', 'Target')));
  fs.writeFileSync(path.join(rootPath, 'modpacks', 'target', 'payload.bin'), Buffer.from([0, 1, 2, 255]));
  fs.writeFileSync(path.join(rootPath, 'modpacks.json'), JSON.stringify({ selectedModpack: 'target', modpacks: { source: { name: 'Source' }, target: { name: 'Target' } } }));
  fs.writeFileSync(path.join(rootPath, 'modpacks-metadata.json'), JSON.stringify({ selectedModpack: 'target', modpacks: { source: { id: 'source', name: 'Source' }, target: { id: 'target', name: 'Target' } } }));
  return rootPath;
}

function config(id: string, name: string) {
  return { id, name, runtime: { minecraft: '1.20.1', modLoader: { type: 'vanilla' } }, memory: { maxMb: 4096 }, vmOptions: [] };
}

function capture(rootPath: string): Record<string, Buffer> {
  return Object.fromEntries([
    'modpacks/target/modpack.json',
    'modpacks/target/payload.bin',
    'modpacks.json',
    'modpacks-metadata.json',
  ].map((file) => [file, fs.readFileSync(path.join(rootPath, file))]));
}
