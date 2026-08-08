import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createShareImportOperationAdapter } from '../shareImportOperation';
import { OperationJournal } from '../operationJournal';
import { OperationRunner } from '../operationRunner';
import type { InstanceCommand } from '../../../domains/instances/instanceTypes';
import type { ModpackManifest } from '../../../../shared/types';

const roots: string[] = [];

describe('share import operation', () => {
  afterEach(() => {
    for (const rootPath of roots.splice(0)) fs.rmSync(rootPath, { recursive: true, force: true });
  });

  it('resolves the manifest only in main, stages content, and commits its canonical record', async () => {
    const rootPath = seedRoot();
    const resolveShareCode = vi.fn(async () => manifest());
    const stageManifest = vi.fn(async (stagingRoot: string, destinationId: string) => {
      fs.mkdirSync(path.join(stagingRoot, 'modpacks', destinationId, 'mods'), { recursive: true });
      fs.writeFileSync(path.join(stagingRoot, 'modpacks', destinationId, 'mods', 'required.jar'), 'bytes');
      return [];
    });
    const { runner, execute } = createRunner({ resolveShareCode, stageManifest });

    const started = runner.start({ kind: 'import-share', rootPath, shareCode: 'H4s=' });
    const completed = await runner.waitFor(started.id);

    expect(completed).toMatchObject({ status: 'succeeded', result: { status: 'succeeded', instanceId: 'shared-pack' } });
    expect(resolveShareCode).toHaveBeenCalledWith('H4s=');
    expect(stageManifest).toHaveBeenCalledWith(expect.stringContaining('.burrow-operations'), 'shared-pack', manifest());
    expect(fs.readFileSync(path.join(rootPath, 'modpacks', 'shared-pack', 'mods', 'required.jar'), 'utf8')).toBe('bytes');
    expect(execute).toHaveBeenCalledWith(expect.objectContaining({
      version: 1,
      type: 'commit-published',
      select: true,
      record: expect.objectContaining({ id: 'shared-pack', name: 'Shared Pack' }),
    }));
  });

  it('rolls back published bytes when the canonical commit fails', async () => {
    const rootPath = seedRoot();
    const { runner } = createRunner({
      resolveShareCode: async () => manifest(),
      stageManifest: writeStagedContent,
      execute: async () => { throw new Error('control-plane unavailable'); },
    });

    const completed = await runner.waitFor(runner.start({ kind: 'import-share', rootPath, shareCode: 'H4s=' }).id);

    expect(completed).toMatchObject({ status: 'failed', result: { status: 'failed' } });
    expect(fs.existsSync(path.join(rootPath, 'modpacks', 'shared-pack'))).toBe(false);
  });

  it('fails before publish when a required shared file cannot be staged', async () => {
    const rootPath = seedRoot();
    const { runner, execute } = createRunner({
      resolveShareCode: async () => manifest({ required: true }),
      stageManifest: async () => [{ index: 0, reason: 'content-install-failed' }],
    });

    const completed = await runner.waitFor(runner.start({ kind: 'import-share', rootPath, shareCode: 'H4s=' }).id);

    expect(completed).toMatchObject({ status: 'failed', result: { status: 'failed' } });
    expect(execute).not.toHaveBeenCalled();
    expect(fs.existsSync(path.join(rootPath, 'modpacks', 'shared-pack'))).toBe(false);
  });

  it('cancels during staging and removes staged bytes before publish', async () => {
    const rootPath = seedRoot();
    let cancel: (() => boolean) | undefined;
    const { runner, execute } = createRunner({
      resolveShareCode: async () => manifest(),
      stageManifest: async (stagingRoot, destinationId) => {
        await writeStagedContent(stagingRoot, destinationId);
        cancel?.();
        return [];
      },
    });
    const started = runner.start({ kind: 'import-share', rootPath, shareCode: 'H4s=' });
    cancel = () => runner.cancel(started.id);

    expect(await runner.waitFor(started.id)).toMatchObject({ status: 'cancelled', result: { status: 'cancelled' } });
    expect(execute).not.toHaveBeenCalled();
    expect(fs.existsSync(path.join(rootPath, 'modpacks', 'shared-pack'))).toBe(false);
    expect(fs.existsSync(path.join(rootPath, '.burrow-operations', 'staging', started.id))).toBe(false);
  });

  it('replays the persisted canonical command for a published share import after restart', async () => {
    const rootPath = seedRoot();
    const execute = vi.fn(async () => ({ status: 'committed' as const, snapshot: snapshot('shared-pack') }));
    const id = '11111111-1111-4111-8111-111111111111';
    new OperationJournal(rootPath).save({
      id,
      kind: 'import-share',
      rootPath,
      status: 'running',
      phase: 'published',
      progress: { completed: 3, total: 4 },
      createdAt: '2026-08-04T00:00:00.000Z',
      updatedAt: '2026-08-04T00:00:00.000Z',
      input: { kind: 'import-share', rootPath, shareCode: 'H4s=' },
      recovery: {
        destinationId: 'shared-pack',
        destinationName: 'Shared Pack',
        missing: [],
        canonicalCommand: {
          version: 1,
          rootPath,
          operationId: id,
          command: { version: 1, type: 'commit-published', record: record('shared-pack'), select: true },
        },
      },
    });
    const { runner } = createRunner({ resolveShareCode: async () => manifest(), stageManifest: writeStagedContent, execute });

    await runner.recover(rootPath);

    expect(execute).toHaveBeenCalledWith({ version: 1, type: 'commit-published', record: record('shared-pack'), select: true });
    expect(runner.get(id)).toMatchObject({ status: 'recovered', result: { status: 'recovered', instanceId: 'shared-pack' } });
  });
});

function seedRoot(): string {
  const rootPath = fs.mkdtempSync(path.join(os.tmpdir(), 'burrow-share-import-operation-'));
  roots.push(rootPath);
  fs.mkdirSync(path.join(rootPath, 'modpacks'), { recursive: true });
  return rootPath;
}

function manifest(file?: ModpackManifest['files'][number]): ModpackManifest {
  return {
    formatVersion: 1,
    minecraft: { version: '1.21.1', modLoaders: [{ id: 'fabric-0.16.0', primary: true }] },
    name: 'Shared Pack',
    version: '1.0.0',
    files: file === undefined ? [] : [file],
  };
}

async function writeStagedContent(stagingRoot: string, destinationId: string): Promise<readonly []> {
  fs.mkdirSync(path.join(stagingRoot, 'modpacks', destinationId, 'mods'), { recursive: true });
  fs.writeFileSync(path.join(stagingRoot, 'modpacks', destinationId, 'mods', 'required.jar'), 'bytes');
  return [];
}

function createRunner(options: {
  resolveShareCode: (code: string) => Promise<ModpackManifest>;
  stageManifest: (stagingRoot: string, destinationId: string, manifest: ModpackManifest) => Promise<readonly { index: number; reason: string }[]>;
  execute?: (command: InstanceCommand) => Promise<{ status: 'committed' | 'noop'; snapshot: ReturnType<typeof snapshot> }>;
}) {
  const execute = vi.fn(options.execute ?? (async (command: InstanceCommand) => ({ status: 'committed' as const, snapshot: snapshot(command.type === 'commit-published' ? command.record.id : 'selected') })));
  return {
    execute,
    runner: new OperationRunner([createShareImportOperationAdapter({
      resolveShareCode: options.resolveShareCode,
      stageManifest: options.stageManifest,
    })], {
      rootMutationCoordinator: {
        forRoot: () => ({
          read: async () => ({ status: 'ready' as const, snapshot: snapshot('selected') }),
          prepare: async () => ({ status: 'ready' as const, source: 'canonical' as const, snapshot: snapshot('selected') }),
          execute,
        }),
      },
    }),
  };
}

function record(id: string) {
  return {
    id,
    name: 'Shared Pack',
    source: { source: 'local' as const, createdAt: '2026-08-04T00:00:00.000Z', updatedAt: '2026-08-04T00:00:00.000Z' },
    config: { runtime: { minecraftVersion: '1.21.1', modLoader: { type: 'fabric' as const, version: '0.16.0' } }, memory: { maxMb: 4096 }, vmOptions: [] },
    summary: { minecraftVersion: '1.21.1', modLoader: { type: 'fabric' as const, version: '0.16.0' } },
  };
}

function snapshot(selectedId: string) {
  return { selectedId, records: [record(selectedId)] };
}
