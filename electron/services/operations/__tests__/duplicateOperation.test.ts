import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OperationRunner } from '../operationRunner';
import { OperationJournal } from '../operationJournal';
import { createDuplicateOperationAdapter } from '../duplicateOperation';
import type { InstanceCommand } from '../../../domains/instances/instanceTypes';

describe('duplicate operation', () => {
  const tempDirs: string[] = [];
  afterEach(() => { for (const dir of tempDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true }); });

  it('reports the published instance id only after a successful duplicate', async () => {
    const rootPath = fs.mkdtempSync(path.join(os.tmpdir(), 'burrow-duplicate-success-'));
    tempDirs.push(rootPath);
    seed(rootPath);
    const { runner, execute } = createRunner();

    const started = runner.start({ kind: 'duplicate', rootPath, sourceId: 'source', destinationId: 'published-copy' });
    const completed = await runner.waitFor(started.id);

    expect(completed).toMatchObject({
      status: 'succeeded',
      result: { status: 'succeeded', instanceId: 'published-copy' },
    });
    expect(fs.existsSync(path.join(rootPath, 'modpacks', 'published-copy', 'modpack.json'))).toBe(true);
    expect(execute).toHaveBeenCalledWith(expect.objectContaining({
      version: 1,
      type: 'commit-published',
      select: true,
      record: expect.objectContaining({ id: 'published-copy', name: 'Source Copy' }),
    }));
  });

  it.each(['copy', 'validation', 'publish', 'control-plane'] as const)(
    'preserves source, existing destination and control-plane files when %s fails',
    async (fault) => {
      const rootPath = fs.mkdtempSync(path.join(os.tmpdir(), 'burrow-duplicate-fault-'));
      tempDirs.push(rootPath);
      seed(rootPath);
      const before = capture(rootPath);
      const { runner } = createRunner({ faults: { [fault]: () => { throw new Error(`${fault} failed`); } } });

      const started = runner.start({ kind: 'duplicate', rootPath, sourceId: 'source', destinationId: 'destination', name: 'Destination' });
      const completed = await runner.waitFor(started.id);

      expect(completed).toMatchObject({ status: 'failed', result: { status: 'failed' } });
      expect(capture(rootPath)).toEqual(before);
      expect(fs.existsSync(path.join(rootPath, '.burrow-operations', 'staging', started.id))).toBe(false);
    },
  );

  it('cancels before publish without changing live files', async () => {
    const rootPath = fs.mkdtempSync(path.join(os.tmpdir(), 'burrow-duplicate-cancel-'));
    tempDirs.push(rootPath);
    seed(rootPath);
    const before = capture(rootPath);
    let cancel: (() => boolean) | undefined;
    const { runner } = createRunner({ faults: {
      validation: () => { cancel?.(); },
    } });
    const started = runner.start({ kind: 'duplicate', rootPath, sourceId: 'source', destinationId: 'destination' });
    cancel = () => runner.cancel(started.id);

    const completed = await runner.waitFor(started.id);
    expect(completed).toMatchObject({ status: 'cancelled', result: { status: 'cancelled' } });
    expect(capture(rootPath)).toEqual(before);
  });

  it('persists the complete canonical command before a post-publish fault', async () => {
    const rootPath = fs.mkdtempSync(path.join(os.tmpdir(), 'burrow-duplicate-command-'));
    tempDirs.push(rootPath);
    seed(rootPath);
    let recorded: unknown;
    const { runner } = createRunner({ faults: {
      'control-plane': () => {
        recorded = new OperationJournal(rootPath).get(runner.get(started.id)!.id)?.recovery?.canonicalCommand;
        throw new Error('simulated crash after publish');
      },
    } });
    const started = runner.start({ kind: 'duplicate', rootPath, sourceId: 'source', destinationId: 'published-copy' });

    await expect(runner.waitFor(started.id)).resolves.toMatchObject({ status: 'failed' });
    expect(recorded).toMatchObject({
      version: 1,
      rootPath,
      operationId: started.id,
      command: { version: 1, type: 'commit-published', select: true, record: { id: 'published-copy' } },
    });
  });
});

function seed(rootPath: string): void {
  fs.mkdirSync(path.join(rootPath, 'modpacks', 'source'), { recursive: true });
  fs.mkdirSync(path.join(rootPath, 'modpacks', 'destination'), { recursive: true });
  fs.writeFileSync(path.join(rootPath, 'modpacks', 'source', 'payload.txt'), 'source bytes');
  fs.writeFileSync(path.join(rootPath, 'modpacks', 'source', 'modpack.json'), JSON.stringify({ id: 'source', name: 'Source', runtime: { minecraft: '1.20.1' }, memory: { maxMb: 4096 }, vmOptions: [] }));
  fs.writeFileSync(path.join(rootPath, 'modpacks', 'destination', 'payload.txt'), 'original destination');
  fs.writeFileSync(path.join(rootPath, 'modpacks', 'destination', 'modpack.json'), JSON.stringify({ id: 'destination', name: 'Original', runtime: { minecraft: '1.20.1' }, memory: { maxMb: 4096 }, vmOptions: [] }));
  fs.writeFileSync(path.join(rootPath, 'modpacks.json'), JSON.stringify({ selectedModpack: 'source', modpacks: { source: { name: 'Source' }, destination: { name: 'Original' } } }));
  fs.writeFileSync(path.join(rootPath, 'modpacks-metadata.json'), JSON.stringify({ selectedModpack: 'source', modpacks: {} }));
}

function createRunner(options: Parameters<typeof createDuplicateOperationAdapter>[0] = {}) {
  const execute = vi.fn(async (command: InstanceCommand) => ({
    status: 'committed' as const,
    snapshot: command.type === 'commit-published'
      ? { selectedId: command.record.id, records: [command.record] }
      : { selectedId: 'source', records: [record('source', 'Source')] },
  }));
  return {
    execute,
    runner: new OperationRunner([createDuplicateOperationAdapter(options)], {
      rootMutationCoordinator: {
        forRoot: () => ({
          read: async () => ({ status: 'ready' as const, snapshot: { selectedId: 'source', records: [record('source', 'Source')] } }),
          prepare: async () => ({ status: 'ready' as const, source: 'canonical' as const, snapshot: { selectedId: 'source', records: [record('source', 'Source')] } }),
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

function capture(rootPath: string): Record<string, string> {
  const files = [
    'modpacks/source/payload.txt', 'modpacks/source/modpack.json', 'modpacks/destination/payload.txt', 'modpacks/destination/modpack.json', 'modpacks.json', 'modpacks-metadata.json',
  ];
  return Object.fromEntries(files.map((file) => [file, fs.readFileSync(path.join(rootPath, file), 'utf8')]));
}
