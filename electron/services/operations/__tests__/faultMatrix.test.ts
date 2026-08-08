import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { InstanceCommand } from '../../../domains/instances/instanceTypes';
import { OperationJournal } from '../operationJournal';
import { OperationRunner } from '../operationRunner';
import { createDuplicateOperationAdapter } from '../duplicateOperation';
import type { OperationAdapter, OperationSnapshot } from '../operationTypes';

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

function root(): string {
  const value = fs.mkdtempSync(path.join(os.tmpdir(), 'burrow-operation-fault-'));
  roots.push(value);
  return value;
}

function record(id = 'copy') {
  return {
    id,
    name: 'Copy',
    source: { source: 'local' as const, createdAt: '2026-08-04T00:00:00.000Z', updatedAt: '2026-08-04T00:00:00.000Z' },
    config: { runtime: { minecraftVersion: '1.20.1', modLoader: { type: 'vanilla' as const } } },
    summary: { minecraftVersion: '1.20.1', modLoader: { type: 'vanilla' as const } },
  };
}

function coordinator(executed: InstanceCommand[] = []) {
  const source = record('source');
  return {
    forRoot: () => ({
      read: async () => ({ status: 'ready' as const, snapshot: { selectedId: source.id, records: [source] } }),
      prepare: async () => ({ status: 'ready' as const, source: 'canonical' as const, snapshot: { selectedId: source.id, records: [source] } }),
      execute: async (command: InstanceCommand) => {
        executed.push(command);
        return { status: 'committed' as const, snapshot: { selectedId: command.type === 'commit-published' ? command.record.id : source.id, records: [source] } };
      },
    }),
  };
}

function seedDuplicate(rootPath: string): void {
  const source = path.join(rootPath, 'modpacks', 'source');
  fs.mkdirSync(source, { recursive: true });
  fs.writeFileSync(path.join(source, 'payload.txt'), 'original bytes');
  fs.writeFileSync(path.join(source, 'modpack.json'), JSON.stringify({
    id: 'source', name: 'Source', runtime: { minecraft: '1.20.1', modLoader: { type: 'vanilla' } }, memory: { maxMb: 4096 }, vmOptions: [],
  }));
}

function publishedSnapshot(rootPath: string, id: string): OperationSnapshot {
  const command = { version: 1 as const, type: 'commit-published' as const, record: record('copy'), select: true };
  return {
    id,
    kind: 'duplicate',
    rootPath,
    instanceId: 'source',
    status: 'running',
    phase: 'published',
    progress: { completed: 3, total: 4 },
    createdAt: '2026-08-04T00:00:00.000Z',
    updatedAt: '2026-08-04T00:00:00.000Z',
    input: { kind: 'duplicate', rootPath, sourceId: 'source', destinationId: 'copy' },
    recovery: {
      sourceId: 'source',
      destinationId: 'copy',
      destinationName: 'Copy',
      publishIntent: { destinationId: 'copy', destinationExisted: false },
      canonicalCommand: { version: 1, rootPath, operationId: id, command },
    },
  };
}

describe('operation publication fault matrix', () => {
  it('keeps required download failure, optional degradation, and cancellation terminal across restart', async () => {
    const rootPath = root();
    let release: (() => void) | undefined;
    const cancellationGate = new Promise<void>((resolve) => { release = resolve; });
    const adapters: OperationAdapter[] = [
      {
        kind: 'install-modrinth',
        async run(context) {
          context.setRecoveryData({ destinationId: 'required-copy', destinationName: 'Required Copy', missing: [] });
          context.transition('staged');
          return { status: 'failed', code: 'OPERATION_FAILED', message: 'required download failed' };
        },
      },
      {
        kind: 'install-curseforge',
        async run(context) {
          context.setRecoveryData({ destinationId: 'optional-copy', destinationName: 'Optional Copy', missing: [{ path: 'mods/optional.jar', reason: '404' }] });
          context.transition('staged');
          return { status: 'degraded', instanceId: 'optional-copy', missing: [{ path: 'mods/optional.jar', reason: '404' }] };
        },
      },
      {
        kind: 'duplicate',
        async run(context) {
          context.setRecoveryData({ sourceId: 'source', destinationId: 'cancelled-copy', destinationName: 'Cancelled Copy' });
          context.transition('staged');
          await cancellationGate;
          return context.isCancelled() ? { status: 'cancelled' } : { status: 'succeeded', instanceId: 'cancelled-copy' };
        },
      },
    ];
    const runner = new OperationRunner(adapters, { rootMutationCoordinator: coordinator() });
    const required = runner.start({ kind: 'install-modrinth', rootPath, projectId: 'project', versionId: 'version', destinationId: 'required-copy' });
    const optional = runner.start({ kind: 'install-curseforge', rootPath, projectId: 1, fileId: 2, destinationId: 'optional-copy' });
    const cancelled = runner.start({ kind: 'duplicate', rootPath, sourceId: 'source', destinationId: 'cancelled-copy' });
    await vi.waitFor(() => expect(runner.get(cancelled.id)?.phase).toBe('staged'));
    expect(runner.cancel(cancelled.id)).toBe(true);
    release?.();

    await expect(runner.waitFor(required.id)).resolves.toMatchObject({ status: 'failed', result: { code: 'OPERATION_FAILED' } });
    await expect(runner.waitFor(optional.id)).resolves.toMatchObject({ status: 'degraded', result: { missing: [{ path: 'mods/optional.jar', reason: '404' }] } });
    await expect(runner.waitFor(cancelled.id)).resolves.toMatchObject({ status: 'cancelled' });
    expect(fs.existsSync(path.join(rootPath, 'modpacks', 'required-copy'))).toBe(false);

    const restarted = new OperationRunner(adapters, { rootMutationCoordinator: coordinator() });
    await restarted.recover(rootPath);
    expect(new OperationJournal(rootPath).get(required.id)).toMatchObject({ status: 'failed' });
    expect(new OperationJournal(rootPath).get(optional.id)).toMatchObject({ status: 'degraded' });
    expect(new OperationJournal(rootPath).get(cancelled.id)).toMatchObject({ status: 'cancelled' });
  });

  it('keeps a crash before publication failed and performs no destination write after restart', async () => {
    const rootPath = root();
    seedDuplicate(rootPath);
    const runner = new OperationRunner([createDuplicateOperationAdapter({ faults: { publish: () => { throw new Error('crash before publish'); } } })], {
      rootMutationCoordinator: coordinator(),
    });
    const started = runner.start({ kind: 'duplicate', rootPath, sourceId: 'source', destinationId: 'copy' });

    await expect(runner.waitFor(started.id)).resolves.toMatchObject({ status: 'failed', result: { message: 'crash before publish' } });
    expect(fs.existsSync(path.join(rootPath, 'modpacks', 'copy'))).toBe(false);
    await new OperationRunner([createDuplicateOperationAdapter()], { rootMutationCoordinator: coordinator() }).recover(rootPath);
    expect(new OperationJournal(rootPath).get(started.id)).toMatchObject({ status: 'failed', phase: 'failed' });
  });

  it('replays only the durable command after a post-publish crash and removes owned publication residue', async () => {
    const rootPath = root();
    const operationId = '11111111-1111-4111-8111-111111111111';
    const destination = path.join(rootPath, 'modpacks', 'copy');
    fs.mkdirSync(destination, { recursive: true });
    fs.writeFileSync(path.join(destination, '.fmcl-operation-publish.json'), JSON.stringify({ operationId }));
    new OperationJournal(rootPath).save(publishedSnapshot(rootPath, operationId));
    const executed: InstanceCommand[] = [];
    const restarted = new OperationRunner([createDuplicateOperationAdapter()], { rootMutationCoordinator: coordinator(executed) });

    await restarted.recover(rootPath);

    expect(executed).toHaveLength(1);
    expect(executed[0]).toMatchObject({ type: 'commit-published', record: { id: 'copy' } });
    expect(new OperationJournal(rootPath).get(operationId)).toMatchObject({ status: 'recovered', phase: 'completed' });
    expect(fs.existsSync(path.join(destination, '.fmcl-operation-publish.json'))).toBe(false);
    await new OperationRunner([createDuplicateOperationAdapter()], { rootMutationCoordinator: coordinator() }).recover(rootPath);
    expect(new OperationJournal(rootPath).get(operationId)).toMatchObject({ status: 'recovered' });
  });
});
