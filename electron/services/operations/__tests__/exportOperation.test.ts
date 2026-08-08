import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createExportOperationAdapter } from '../exportOperation';
import { OperationJournal } from '../operationJournal';
import { OperationRunner } from '../operationRunner';
import type { InstanceCommand } from '../../../domains/instances/instanceTypes';

describe('staged archive export operation', () => {
  const tempDirs: string[] = [];

  afterEach(() => { for (const dir of tempDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true }); });

  it('writes and validates a private sibling archive before publishing it', async () => {
    const { rootPath, outputPath } = seedOutput(tempDirs);
    const runner = new OperationRunner([createExportOperationAdapter({
      writeArchive: async ({ outputPath: stagedPath }) => {
        expect(path.dirname(stagedPath)).not.toBe(path.dirname(outputPath));
        fs.writeFileSync(stagedPath, 'PK\x03\x04new archive bytes');
      },
    })]);

    const started = runner.start(request(rootPath, outputPath));

    await expect(runner.waitFor(started.id)).resolves.toMatchObject({ status: 'succeeded', result: { status: 'succeeded', instanceId: 'export-me' } });
    expect(fs.readFileSync(outputPath, 'utf8')).toBe('PK\x03\x04new archive bytes');
    expect(fs.readdirSync(path.dirname(outputPath)).some((name) => name.includes('.burrow-export-'))).toBe(false);
  });

  it.each(['write', 'publish'] as const)('restores an existing destination when %s fails', async (fault) => {
    const { rootPath, outputPath } = seedOutput(tempDirs);
    const runner = new OperationRunner([createExportOperationAdapter({
      faults: { [fault]: () => { throw new Error(`${fault} failed`); } },
      writeArchive: async ({ outputPath: stagedPath }) => fs.writeFileSync(stagedPath, 'PK\x03\x04new archive bytes'),
    })]);

    const started = runner.start(request(rootPath, outputPath));

    await expect(runner.waitFor(started.id)).resolves.toMatchObject({ status: 'failed', result: { status: 'failed' } });
    expect(fs.readFileSync(outputPath, 'utf8')).toBe('previous archive bytes');
  });

  it('restores an existing destination when cancellation arrives after backup and before publish', async () => {
    const { rootPath, outputPath } = seedOutput(tempDirs);
    let cancel: (() => boolean) | undefined;
    const runner = new OperationRunner([createExportOperationAdapter({
      hooks: { afterBackup: () => { cancel?.(); } },
      writeArchive: async ({ outputPath: stagedPath }) => fs.writeFileSync(stagedPath, 'PK\x03\x04new archive bytes'),
    })]);
    const started = runner.start(request(rootPath, outputPath));
    cancel = () => runner.cancel(started.id);

    await expect(runner.waitFor(started.id)).resolves.toMatchObject({ status: 'cancelled', result: { status: 'cancelled' } });
    expect(fs.readFileSync(outputPath, 'utf8')).toBe('previous archive bytes');
  });

  it('preserves an external archive that appears during rollback as recovery-required', async () => {
    const { rootPath, outputPath } = seedOutput(tempDirs);
    const runner = new OperationRunner([createExportOperationAdapter({
      hooks: { afterBackup: () => fs.writeFileSync(outputPath, 'external archive bytes') },
      faults: { publish: () => { throw new Error('publish failed'); } },
      writeArchive: async ({ outputPath: stagedPath }) => fs.writeFileSync(stagedPath, 'PK\x03\x04new archive bytes'),
    })]);
    const started = runner.start(request(rootPath, outputPath));
    await expect(runner.waitFor(started.id)).resolves.toMatchObject({ status: 'recovery-required' });
    expect(fs.readFileSync(outputPath, 'utf8')).toBe('external archive bytes');
  });
});

describe('journaled manifest export operation', () => {
  const tempDirs: string[] = [];

  afterEach(() => { for (const dir of tempDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true }); });

  it('records and commits the exact canonical manifest command only after publishing the verified instance copy', async () => {
    const rootPath = seedManifestInstance(tempDirs);
    const { runner, execute } = createManifestRunner();

    const started = runner.start(manifestRequest(rootPath));

    await expect(runner.waitFor(started.id)).resolves.toMatchObject({
      status: 'succeeded',
      phase: 'completed',
      result: { status: 'succeeded', instanceId: 'export-me' },
    });
    expect(JSON.parse(fs.readFileSync(path.join(rootPath, 'modpacks', 'export-me', 'manifest.json'), 'utf8'))).toMatchObject({
      formatVersion: 1,
      name: 'Published pack',
      version: '2.0.0',
    });
    expect(execute).toHaveBeenCalledWith(expect.objectContaining({
      version: 1,
      type: 'reconcile-update',
      record: expect.objectContaining({
        id: 'export-me',
        name: 'Published pack',
        source: expect.objectContaining({ source: 'local', version: '2.0.0', author: 'Friend' }),
      }),
    }));
    expect(fs.existsSync(path.join(rootPath, 'modpacks', 'export-me', '.burrow-operation-publish.json'))).toBe(false);
  });

  it('persists the exact root-bound manifest command before publish and replays it once after a post-publish crash', async () => {
    const rootPath = seedManifestInstance(tempDirs);
    let startedId = '';
    let durable: unknown;
    const { runner } = createManifestRunner({
      faults: {
        'control-plane': () => {
          durable = new OperationJournal(rootPath).get(startedId)?.recovery?.canonicalCommand;
          throw new Error('simulated post-publish crash');
        },
      },
    });
    const started = runner.start(manifestRequest(rootPath));
    startedId = started.id;

    await expect(runner.waitFor(started.id)).resolves.toMatchObject({ status: 'failed' });
    expect(durable).toMatchObject({
      version: 1,
      rootPath,
      operationId: started.id,
      command: {
        version: 1,
        type: 'reconcile-update',
        record: { id: 'export-me', name: 'Published pack' },
      },
    });

    const journal = new OperationJournal(rootPath);
    const interrupted = journal.get(started.id)!;
    const published = { ...interrupted };
    delete published.result;
    journal.save({ ...published, status: 'running', phase: 'published' });
    const { runner: recoveryRunner, execute } = createManifestRunner();

    await recoveryRunner.recover(rootPath);

    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute).toHaveBeenCalledWith((durable as { command: InstanceCommand }).command);
    expect(recoveryRunner.get(started.id)).toMatchObject({
      status: 'recovered',
      result: { status: 'recovered', instanceId: 'export-me' },
    });
  });

  it.each(['validation', 'publish', 'control-plane'] as const)('never mutates live manifest or metadata when %s fails', async (fault) => {
    const rootPath = seedManifestInstance(tempDirs);
    const { runner } = createManifestRunner({
      faults: { [fault]: () => { throw new Error(`${fault} failed`); } },
    });

    const started = runner.start(manifestRequest(rootPath));

    await expect(runner.waitFor(started.id)).resolves.toMatchObject({ status: 'failed', result: { status: 'failed' } });
    expect(fs.readFileSync(path.join(rootPath, 'modpacks', 'export-me', 'manifest.json'), 'utf8')).toBe('{"old":true}');
    expect(JSON.parse(fs.readFileSync(path.join(rootPath, 'modpacks-metadata.json'), 'utf8'))).toMatchObject({
      modpacks: { 'export-me': { name: 'Old pack', version: '1.0.0' } },
    });
  });

  it('restores the prior instance and metadata when cancellation arrives after backup', async () => {
    const rootPath = seedManifestInstance(tempDirs);
    let cancel: (() => boolean) | undefined;
    const { runner } = createManifestRunner({
      hooks: { afterBackup: () => { cancel?.(); } },
    });
    const started = runner.start(manifestRequest(rootPath));
    cancel = () => runner.cancel(started.id);

    await expect(runner.waitFor(started.id)).resolves.toMatchObject({ status: 'cancelled', result: { status: 'cancelled' } });
    expect(fs.readFileSync(path.join(rootPath, 'modpacks', 'export-me', 'manifest.json'), 'utf8')).toBe('{"old":true}');
    expect(JSON.parse(fs.readFileSync(path.join(rootPath, 'modpacks-metadata.json'), 'utf8'))).toMatchObject({
      modpacks: { 'export-me': { name: 'Old pack', version: '1.0.0' } },
    });
  });
});

function request(rootPath: string, outputPath: string) {
  return { kind: 'export' as const, rootPath, instanceId: 'export-me', format: 'zip' as const, outputPath };
}

function createManifestRunner(options: Parameters<typeof createExportOperationAdapter>[0] = {}) {
  const record = canonicalRecord();
  const snapshot = { selectedId: record.id, records: [record] };
  const execute = vi.fn(async (command: InstanceCommand) => ({
    status: 'committed' as const,
    snapshot: command.type === 'reconcile-update'
      ? { selectedId: record.id, records: [command.record] }
      : snapshot,
  }));
  return {
    execute,
    runner: new OperationRunner([createExportOperationAdapter(options)], {
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

function canonicalRecord() {
  return {
    id: 'export-me',
    name: 'Old pack',
    source: { source: 'local' as const, createdAt: '2026-08-03T00:00:00.000Z', updatedAt: '2026-08-03T00:00:00.000Z' },
    config: { runtime: { minecraftVersion: '1.20.1', modLoader: { type: 'vanilla' as const } }, memory: { maxMb: 4096 }, vmOptions: [] },
    summary: { minecraftVersion: '1.20.1', modLoader: { type: 'vanilla' as const } },
  };
}

function seedOutput(tempDirs: string[]): { rootPath: string; outputPath: string } {
  const rootPath = fs.mkdtempSync(path.join(os.tmpdir(), 'burrow-export-operation-'));
  tempDirs.push(rootPath);
  fs.mkdirSync(path.join(rootPath, 'modpacks', 'export-me'), { recursive: true });
  const outputPath = path.join(rootPath, 'exports', 'export-me.zip');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, 'previous archive bytes');
  return { rootPath, outputPath };
}

function manifestRequest(rootPath: string) {
  return {
    kind: 'export' as const,
    rootPath,
    instanceId: 'export-me',
    format: 'manifest' as const,
    name: 'Published pack',
    version: '2.0.0',
    author: 'Friend',
  };
}

function seedManifestInstance(tempDirs: string[]): string {
  const rootPath = fs.mkdtempSync(path.join(os.tmpdir(), 'burrow-manifest-export-operation-'));
  tempDirs.push(rootPath);
  const instancePath = path.join(rootPath, 'modpacks', 'export-me');
  fs.mkdirSync(path.join(instancePath, 'mods'), { recursive: true });
  fs.writeFileSync(path.join(instancePath, 'modpack.json'), JSON.stringify({
    id: 'export-me',
    name: 'Old pack',
    runtime: { minecraft: '1.20.1', modLoader: { type: 'vanilla' } },
    memory: { maxMb: 4096 },
    vmOptions: [],
    createdAt: '2026-08-03T00:00:00.000Z',
    updatedAt: '2026-08-03T00:00:00.000Z',
  }));
  fs.writeFileSync(path.join(instancePath, 'manifest.json'), '{"old":true}');
  fs.writeFileSync(path.join(rootPath, 'modpacks-metadata.json'), JSON.stringify({
    selectedModpack: 'export-me',
    modpacks: {
      'export-me': {
        id: 'export-me', name: 'Old pack', version: '1.0.0', source: 'local', minecraftVersion: '1.20.1',
        createdAt: '2026-08-03T00:00:00.000Z', updatedAt: '2026-08-03T00:00:00.000Z',
      },
    },
  }));
  return rootPath;
}
