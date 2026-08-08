import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OperationJournal } from '../operationJournal';
import { OperationRunner } from '../operationRunner';
import type { CanonicalInstanceRecord, CanonicalInstanceSnapshot, InstanceCommand } from '../../../domains/instances/instanceTypes';
import type { OperationSnapshot } from '../operationTypes';

const temporaryRoots: string[] = [];

afterEach(() => {
  for (const rootPath of temporaryRoots.splice(0)) {
    fs.rmSync(rootPath, { recursive: true, force: true });
  }
});

describe('canonical recovery commands', () => {
  it('rejects malformed, unversioned, root-mismatched, and unsupported canonical recovery commands', () => {
    const rootPath = fs.mkdtempSync(path.join(os.tmpdir(), 'burrow-canonical-recovery-'));
    temporaryRoots.push(rootPath);

    const journal = new OperationJournal(rootPath);
    for (const canonicalCommand of [
      { rootPath, operationId: operationId(), command: command() },
      { version: 1, rootPath: path.join(rootPath, 'foreign'), operationId: operationId(), command: command() },
      { version: 1, rootPath, operationId: operationId(), command: { version: 2, type: 'delete', id: 'target' } },
      { version: 1, rootPath, operationId: operationId(), command: { version: 1, type: 'unknown' } },
    ]) {
      expect(() => journal.save({
        ...snapshot(rootPath),
        recovery: recovery(canonicalCommand),
      })).toThrow(/invalid/i);
    }
  });

  it('round-trips bounded update-metadata commands and rejects malformed descriptions', () => {
    const rootPath = fs.mkdtempSync(path.join(os.tmpdir(), 'burrow-canonical-recovery-'));
    temporaryRoots.push(rootPath);
    const journal = new OperationJournal(rootPath);
    const metadataCommand = { version: 1 as const, type: 'update-metadata' as const, id: 'target', description: 'Reviewed description' };

    journal.save({
      ...snapshot(rootPath),
      recovery: recovery({ version: 1, rootPath, operationId: operationId(), command: metadataCommand }),
    });
    expect(journal.get(operationId())?.recovery?.canonicalCommand).toEqual({
      version: 1,
      rootPath,
      operationId: operationId(),
      command: metadataCommand,
    });

    expect(() => journal.save({
      ...snapshot(rootPath),
      recovery: recovery({
        version: 1,
        rootPath,
        operationId: operationId(),
        command: { version: 1, type: 'update-metadata', id: 'target', description: 'x'.repeat(4_001) },
      }),
    })).toThrow(/invalid/i);

    expect(() => journal.save({
      ...snapshot(rootPath),
      recovery: recovery({
        version: 1,
        rootPath,
        operationId: operationId(),
        command: { version: 1, type: 'update-metadata', id: 'target', description: '   ' },
      }),
    })).toThrow(/invalid/i);
  });

  it('persists a full canonical command before publication and replays exactly that command after a crash', async () => {
    const rootPath = fs.mkdtempSync(path.join(os.tmpdir(), 'burrow-canonical-recovery-'));
    temporaryRoots.push(rootPath);
    const events: string[] = [];
    const expected = command();
    const execute = vi.fn(async (received: InstanceCommand) => {
      events.push(`replay:${received.type}`);
      expect(received).toEqual(expected);
      return { status: 'committed' as const, snapshot: canonicalSnapshot() };
    });
    const runner = new OperationRunner([{
      kind: 'duplicate',
      run: async (context) => {
        context.setRecoveryData(recovery());
        context.recordCanonicalCommand(expected);
        expect(new OperationJournal(rootPath).get(context.snapshot.id)?.recovery?.canonicalCommand).toEqual({
          version: 1, rootPath, operationId: context.snapshot.id, command: expected,
        });
        events.push('command-recorded');
        context.transition('published');
        events.push('published');
        throw new Error('simulated crash after publish');
      },
    }], { rootMutationCoordinator: { forRoot: () => coordinator(execute) } });

    const started = runner.start({ kind: 'duplicate', rootPath, sourceId: 'source', destinationId: 'target' });
    await runner.waitFor(started.id);
    const journal = new OperationJournal(rootPath);
    journal.save({ ...snapshot(rootPath, started.id), phase: 'published', recovery: recovery({ version: 1, rootPath, operationId: started.id, command: expected }) });

    await runner.recover(rootPath);

    expect(events).toEqual(['command-recorded', 'published', 'replay:commit-published']);
    expect(execute).toHaveBeenCalledTimes(1);
    expect(runner.get(started.id)).toMatchObject({ status: 'recovered', result: { status: 'recovered', instanceId: 'target' } });
  });

  it('replays an already-committed command once as a canonical no-op', async () => {
    const rootPath = fs.mkdtempSync(path.join(os.tmpdir(), 'burrow-canonical-recovery-'));
    temporaryRoots.push(rootPath);
    const execute = vi.fn(async () => ({ status: 'noop' as const, snapshot: canonicalSnapshot() }));
    const journal = new OperationJournal(rootPath);
    journal.save({
      ...snapshot(rootPath),
      phase: 'control-plane-committed',
      recovery: recovery({ version: 1, rootPath, operationId: operationId(), command: command() }),
    });

    const runner = new OperationRunner([], { rootMutationCoordinator: { forRoot: () => coordinator(execute) } });
    await runner.recover(rootPath);
    await runner.recover(rootPath);

    expect(execute).toHaveBeenCalledTimes(1);
    expect(runner.get(operationId())).toMatchObject({ status: 'recovered', result: { status: 'recovered', instanceId: 'target' } });
  });
});

function operationId(): string {
  return '11111111-1111-4111-8111-111111111111';
}

function snapshot(rootPath: string, id = operationId()): OperationSnapshot {
  return {
    id,
    kind: 'duplicate',
    rootPath,
    instanceId: 'source',
    status: 'running',
    phase: 'published',
    progress: { completed: 1, total: 1 },
    createdAt: '2026-08-04T00:00:00.000Z',
    updatedAt: '2026-08-04T00:00:00.000Z',
    input: { kind: 'duplicate' as const, rootPath, sourceId: 'source', destinationId: 'target' },
  };
}

function recovery(canonicalCommand?: unknown) {
  return {
    sourceId: 'source',
    destinationId: 'target',
    destinationName: 'Target',
    ...(canonicalCommand === undefined ? {} : { canonicalCommand }),
  } as import('../operationTypes').OperationRecoveryData;
}

function command(): InstanceCommand {
  return { version: 1, type: 'commit-published', record: record(), select: true };
}

function record(): CanonicalInstanceRecord {
  return {
    id: 'target',
    name: 'Target',
    source: { source: 'local', createdAt: '2026-08-04T00:00:00.000Z', updatedAt: '2026-08-04T00:00:00.000Z' },
    config: { runtime: { minecraftVersion: '1.21.1', modLoader: { type: 'fabric', version: '0.16.0' } }, memory: { maxMb: 4096 } },
    summary: { minecraftVersion: '1.21.1', modLoader: { type: 'fabric', version: '0.16.0' } },
  };
}

function canonicalSnapshot(): CanonicalInstanceSnapshot {
  const target = record();
  return { selectedId: target.id, records: [target] };
}

function coordinator(execute: (command: InstanceCommand) => Promise<{ status: 'committed' | 'noop'; snapshot: CanonicalInstanceSnapshot }>) {
  return {
    read: async () => ({ status: 'ready' as const, snapshot: canonicalSnapshot() }),
    prepare: async () => ({ status: 'ready' as const, source: 'canonical' as const, snapshot: canonicalSnapshot() }),
    execute,
  };
}
