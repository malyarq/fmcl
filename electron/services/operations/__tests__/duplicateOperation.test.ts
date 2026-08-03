import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { OperationRunner } from '../operationRunner';
import { createDuplicateOperationAdapter } from '../duplicateOperation';

describe('duplicate operation', () => {
  const tempDirs: string[] = [];
  afterEach(() => { for (const dir of tempDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true }); });

  it('reports the published instance id only after a successful duplicate', async () => {
    const rootPath = fs.mkdtempSync(path.join(os.tmpdir(), 'fmcl-duplicate-success-'));
    tempDirs.push(rootPath);
    seed(rootPath);
    const runner = new OperationRunner([createDuplicateOperationAdapter()]);

    const started = runner.start({ kind: 'duplicate', rootPath, sourceId: 'source', destinationId: 'published-copy' });
    const completed = await runner.waitFor(started.id);

    expect(completed).toMatchObject({
      status: 'succeeded',
      result: { status: 'succeeded', instanceId: 'published-copy' },
    });
    expect(fs.existsSync(path.join(rootPath, 'modpacks', 'published-copy', 'modpack.json'))).toBe(true);
  });

  it.each(['copy', 'validation', 'publish', 'control-plane'] as const)(
    'preserves source, existing destination and control-plane files when %s fails',
    async (fault) => {
      const rootPath = fs.mkdtempSync(path.join(os.tmpdir(), 'fmcl-duplicate-fault-'));
      tempDirs.push(rootPath);
      seed(rootPath);
      const before = capture(rootPath);
      const runner = new OperationRunner([createDuplicateOperationAdapter({ faults: { [fault]: () => { throw new Error(`${fault} failed`); } } })]);

      const started = runner.start({ kind: 'duplicate', rootPath, sourceId: 'source', destinationId: 'destination', name: 'Destination' });
      const completed = await runner.waitFor(started.id);

      expect(completed).toMatchObject({ status: 'failed', result: { status: 'failed' } });
      expect(capture(rootPath)).toEqual(before);
      expect(fs.existsSync(path.join(rootPath, '.fmcl-operations', 'staging', started.id))).toBe(false);
    },
  );

  it('cancels before publish without changing live files', async () => {
    const rootPath = fs.mkdtempSync(path.join(os.tmpdir(), 'fmcl-duplicate-cancel-'));
    tempDirs.push(rootPath);
    seed(rootPath);
    const before = capture(rootPath);
    let cancel: (() => boolean) | undefined;
    const runner = new OperationRunner([createDuplicateOperationAdapter({ faults: {
      validation: () => { cancel?.(); },
    } })]);
    const started = runner.start({ kind: 'duplicate', rootPath, sourceId: 'source', destinationId: 'destination' });
    cancel = () => runner.cancel(started.id);

    const completed = await runner.waitFor(started.id);
    expect(completed).toMatchObject({ status: 'cancelled', result: { status: 'cancelled' } });
    expect(capture(rootPath)).toEqual(before);
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

function capture(rootPath: string): Record<string, string> {
  const files = [
    'modpacks/source/payload.txt', 'modpacks/source/modpack.json', 'modpacks/destination/payload.txt', 'modpacks/destination/modpack.json', 'modpacks.json', 'modpacks-metadata.json',
  ];
  return Object.fromEntries(files.map((file) => [file, fs.readFileSync(path.join(rootPath, file), 'utf8')]));
}
