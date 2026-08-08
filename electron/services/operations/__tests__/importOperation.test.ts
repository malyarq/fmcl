import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ZipFile } from 'yazl';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createImportOperationAdapter } from '../importOperation';
import { OperationRunner } from '../operationRunner';
import { OperationJournal } from '../operationJournal';
import type { InstanceCommand } from '../../../domains/instances/instanceTypes';

describe('staged archive import operation', () => {
  const tempDirs: string[] = [];
  afterEach(() => { for (const dir of tempDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true }); });

  it.each(['extraction', 'validation', 'publish', 'control-plane'] as const)(
    'preserves existing bytes and index when %s fails',
    async (fault) => {
      const rootPath = seedRoot();
      tempDirs.push(rootPath);
      const before = capture(rootPath);
      const archivePath = await writeMultiMCArchive(rootPath);
      const { runner } = createRunner({ faults: { [fault]: () => { throw new Error(`${fault} failed`); } } });

      const started = runner.start({ kind: 'import', rootPath, filePath: archivePath, destinationId: 'destination' });
      const completed = await runner.waitFor(started.id);

      expect(completed).toMatchObject({ status: 'failed', result: { status: 'failed' } });
      expect(capture(rootPath)).toEqual(before);
      expect(fs.existsSync(path.join(rootPath, '.burrow-operations', 'staging', started.id))).toBe(false);
    },
  );

  it('cancels before publish without changing live files', async () => {
    const rootPath = seedRoot();
    tempDirs.push(rootPath);
    const before = capture(rootPath);
    const archivePath = await writeMultiMCArchive(rootPath);
    let cancel: (() => boolean) | undefined;
    const { runner } = createRunner({ faults: { validation: () => { cancel?.(); } } });
    const started = runner.start({ kind: 'import', rootPath, filePath: archivePath, destinationId: 'destination' });
    cancel = () => runner.cancel(started.id);

    expect(await runner.waitFor(started.id)).toMatchObject({ status: 'cancelled', result: { status: 'cancelled' } });
    expect(capture(rootPath)).toEqual(before);
  });

  it('publishes only validated MultiMC bytes and reports an explicit optional miss as degraded', async () => {
    const rootPath = seedRoot();
    tempDirs.push(rootPath);
    const archivePath = await writeModrinthArchive(rootPath);
    const { runner, execute } = createRunner();

    const started = runner.start({ kind: 'import', rootPath, filePath: archivePath, destinationId: 'modrinth-import' });
    const completed = await runner.waitFor(started.id);

    expect(completed).toMatchObject({
      status: 'degraded',
      result: { status: 'degraded', missing: ['mods/optional.jar'] },
    });
    expect(fs.readFileSync(path.join(rootPath, 'modpacks', 'modrinth-import', 'config', 'required.txt'), 'utf8')).toBe('required bytes');
    expect(execute).toHaveBeenCalledWith(expect.objectContaining({
      version: 1,
      type: 'commit-published',
      select: true,
      record: expect.objectContaining({ id: 'modrinth-import', name: 'Test pack' }),
    }));
  });

  it('rejects traversal archives before they reach the live destination', async () => {
    const rootPath = seedRoot();
    tempDirs.push(rootPath);
    const before = capture(rootPath);
    const archivePath = await writeTraversalArchive(rootPath);
    const { runner } = createRunner();

    const started = runner.start({ kind: 'import', rootPath, filePath: archivePath, destinationId: 'destination' });
    expect(await runner.waitFor(started.id)).toMatchObject({ status: 'failed', result: { status: 'failed' } });
    expect(capture(rootPath)).toEqual(before);
    expect(fs.existsSync(path.join(rootPath, 'escape.txt'))).toBe(false);
  });

  it('persists the complete canonical command before a post-publish fault', async () => {
    const rootPath = seedRoot();
    tempDirs.push(rootPath);
    const archivePath = await writeMultiMCArchive(rootPath);
    let recorded: unknown;
    const { runner } = createRunner({ faults: {
      'control-plane': () => {
        recorded = new OperationJournal(rootPath).get(started.id)?.recovery?.canonicalCommand;
        throw new Error('simulated crash after publish');
      },
    } });
    const started = runner.start({ kind: 'import', rootPath, filePath: archivePath, destinationId: 'published-import' });

    await expect(runner.waitFor(started.id)).resolves.toMatchObject({ status: 'failed' });
    expect(recorded).toMatchObject({
      version: 1,
      rootPath,
      operationId: started.id,
      command: { version: 1, type: 'commit-published', select: true, record: { id: 'published-import' } },
    });
  });
});

function seedRoot(): string {
  const rootPath = fs.mkdtempSync(path.join(os.tmpdir(), 'burrow-import-operation-'));
  fs.mkdirSync(path.join(rootPath, 'modpacks', 'destination'), { recursive: true });
  fs.writeFileSync(path.join(rootPath, 'modpacks', 'destination', 'payload.txt'), 'original destination');
  fs.writeFileSync(path.join(rootPath, 'modpacks', 'destination', 'modpack.json'), JSON.stringify({ id: 'destination', name: 'Original', runtime: { minecraft: '1.20.1' }, memory: { maxMb: 4096 }, vmOptions: [] }));
  fs.writeFileSync(path.join(rootPath, 'modpacks.json'), JSON.stringify({ selectedModpack: 'destination', modpacks: { destination: { name: 'Original' } } }));
  fs.writeFileSync(path.join(rootPath, 'modpacks-metadata.json'), JSON.stringify({ selectedModpack: 'destination', modpacks: {} }));
  return rootPath;
}

function createRunner(options: Parameters<typeof createImportOperationAdapter>[0] = {}) {
  const execute = vi.fn(async (command: InstanceCommand) => ({
    status: 'committed' as const,
    snapshot: command.type === 'commit-published'
      ? { selectedId: command.record.id, records: [command.record] }
      : { selectedId: 'destination', records: [record('destination', 'Original')] },
  }));
  return {
    execute,
    runner: new OperationRunner([createImportOperationAdapter(options)], {
      rootMutationCoordinator: {
        forRoot: () => ({
          read: async () => ({ status: 'ready' as const, snapshot: { selectedId: 'destination', records: [record('destination', 'Original')] } }),
          prepare: async () => ({ status: 'ready' as const, source: 'canonical' as const, snapshot: { selectedId: 'destination', records: [record('destination', 'Original')] } }),
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
  const files = ['modpacks/destination/payload.txt', 'modpacks/destination/modpack.json', 'modpacks.json', 'modpacks-metadata.json'];
  return Object.fromEntries(files.map((file) => [file, fs.readFileSync(path.join(rootPath, file), 'utf8')]));
}

async function writeMultiMCArchive(rootPath: string): Promise<string> {
  return await writeZip(path.join(rootPath, 'multimc.zip'), [
    ['mmc-pack.json', Buffer.from(JSON.stringify({ components: [{ uid: 'net.minecraft', version: '1.20.1' }] }))],
    ['.minecraft/config/options.txt', Buffer.from('safe')],
  ]);
}

async function writeModrinthArchive(rootPath: string): Promise<string> {
  return await writeZip(path.join(rootPath, 'modrinth.mrpack'), [
    ['modrinth.index.json', Buffer.from(JSON.stringify({ formatVersion: 1, game: 'minecraft', versionId: 'test', name: 'Test pack', files: [
      { path: 'config/required.txt', hashes: { sha1: 'a', sha512: 'b' }, downloads: [], fileSize: 14, env: { client: 'required' } },
      { path: 'mods/optional.jar', hashes: { sha1: 'a', sha512: 'b' }, downloads: [], fileSize: 0, env: { client: 'optional' } },
    ] }))],
    ['config/required.txt', Buffer.from('required bytes')],
  ]);
}

async function writeTraversalArchive(rootPath: string): Promise<string> {
  const archivePath = await writeZip(path.join(rootPath, 'traversal.zip'), [['xx/escape.txt', Buffer.from('blocked')]]);
  const bytes = fs.readFileSync(archivePath);
  for (let offset = bytes.indexOf('xx/escape.txt'); offset !== -1; offset = bytes.indexOf('xx/escape.txt', offset + 1)) {
    bytes.write('../escape.txt', offset, 'utf8');
  }
  fs.writeFileSync(archivePath, bytes);
  return archivePath;
}

async function writeZip(archivePath: string, entries: Array<[string, Buffer]>): Promise<string> {
  const zip = new ZipFile();
  for (const [name, bytes] of entries) zip.addBuffer(bytes, name);
  await new Promise<void>((resolve, reject) => {
    zip.outputStream.pipe(fs.createWriteStream(archivePath)).once('close', resolve).once('error', reject);
    zip.end();
  });
  return archivePath;
}
