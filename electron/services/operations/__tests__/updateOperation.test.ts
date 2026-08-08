import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OperationJournal } from '../operationJournal';
import { OperationRunner } from '../operationRunner';
import { createUpdateOperationAdapter } from '../updateOperation';
import type { InstanceCommand } from '../../../domains/instances/instanceTypes';

describe('staged manifest update operation', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    vi.unstubAllGlobals();
    for (const dir of tempDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
  });

  it('downloads verified manifest content into staging before atomically publishing it', async () => {
    const rootPath = seedRoot();
    tempDirs.push(rootPath);
    stubVerifiedManifest();
    const { runner, execute } = createRunner();

    const started = runner.start(request(rootPath));
    const completed = await runner.waitFor(started.id);

    expect(completed).toMatchObject({
      kind: 'update',
      status: 'succeeded',
      result: { status: 'succeeded', instanceId: 'updated-pack' },
    });
    expect(fs.readFileSync(path.join(rootPath, 'modpacks', 'updated-pack', 'mods', 'verified.jar'), 'utf8')).toBe('verified bytes');
    expect(fs.readFileSync(path.join(rootPath, 'modpacks', 'updated-pack', 'payload.txt'), 'utf8')).toBe('original bytes');
    expect(execute).toHaveBeenCalledWith(expect.objectContaining({
      version: 1,
      type: 'reconcile-update',
      record: expect.objectContaining({ id: 'updated-pack', name: 'Updated Pack' }),
    }));
  });

  it.each(['validation', 'publish', 'control-plane'] as const)(
    'preserves the live instance when %s fails after staging',
    async (fault) => {
      const rootPath = seedRoot();
      tempDirs.push(rootPath);
      const before = capture(rootPath);
      stubVerifiedManifest();
      const { runner } = createRunner({ faults: { [fault]: () => { throw new Error(`${fault} failed`); } } });

      const started = runner.start(request(rootPath));

      await expect(runner.waitFor(started.id)).resolves.toMatchObject({ status: 'failed', result: { status: 'failed' } });
      expect(capture(rootPath)).toEqual(before);
      expect(fs.existsSync(path.join(rootPath, '.burrow-operations', 'staging', started.id))).toBe(false);
    },
  );

  it.each([
    ['traversal', '../outside.jar', 'https://cdn.example.com/outside.jar', 5, crypto.createHash('sha1').update('owned').digest('hex')],
    ['non-HTTPS', 'mods/example.jar', 'http://cdn.example.com/example.jar', 5, crypto.createHash('sha1').update('owned').digest('hex')],
    ['size mismatch', 'mods/example.jar', 'https://cdn.example.com/example.jar', 99, crypto.createHash('sha1').update('owned').digest('hex')],
    ['hash mismatch', 'mods/example.jar', 'https://cdn.example.com/example.jar', 5, '0'.repeat(40)],
  ] as const)('never publishes live changes on %s manifest content', async (_name, filePath, url, size, hash) => {
    const rootPath = seedRoot();
    tempDirs.push(rootPath);
    const before = capture(rootPath);
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(manifestResponse({ name: 'Unsafe', files: [{ path: filePath, hash, size, url }] }))
      .mockResolvedValueOnce(new Response('owned', { status: 200 })));
    const { runner } = createRunner();

    const started = runner.start(request(rootPath));

    await expect(runner.waitFor(started.id)).resolves.toMatchObject({ status: 'failed', result: { status: 'failed' } });
    expect(capture(rootPath)).toEqual(before);
    expect(fs.existsSync(path.join(rootPath, 'outside.jar'))).toBe(false);
  });

  it('cancels before publish without changing the live instance', async () => {
    const rootPath = seedRoot();
    tempDirs.push(rootPath);
    const before = capture(rootPath);
    stubVerifiedManifest();
    let cancel: (() => boolean) | undefined;
    const { runner } = createRunner({ faults: {
      validation: () => { cancel?.(); },
    } });
    const started = runner.start(request(rootPath));
    cancel = () => runner.cancel(started.id);

    await expect(runner.waitFor(started.id)).resolves.toMatchObject({ status: 'cancelled', result: { status: 'cancelled' } });
    expect(capture(rootPath)).toEqual(before);
  });

  it('recovers a verified published update journal residue without guessing unsafe state', async () => {
    const rootPath = seedRoot();
    tempDirs.push(rootPath);
    const now = new Date().toISOString();
    const operationId = '11111111-1111-4111-8111-111111111111';
    new OperationJournal(rootPath).save({
      id: operationId,
      kind: 'update',
      rootPath,
      instanceId: 'updated-pack',
      status: 'running',
      phase: 'published',
      progress: { completed: 3, total: 4 },
      createdAt: now,
      updatedAt: now,
      input: request(rootPath),
      recovery: { destinationId: 'updated-pack' },
    });
    const { runner } = createRunner();

    await runner.recover(rootPath);

    expect(runner.get(operationId)).toMatchObject({
      status: 'recovery-required',
      phase: 'recovery-required',
      result: { status: 'recovery-required' },
    });
  });

  it('serializes all writers for one root while leaving reads outside the mutation lock', async () => {
    const rootPath = seedRoot();
    tempDirs.push(rootPath);
    fs.mkdirSync(path.join(rootPath, 'modpacks', 'other-pack'), { recursive: true });
    fs.writeFileSync(path.join(rootPath, 'modpacks', 'other-pack', 'modpack.json'), JSON.stringify({ id: 'other-pack', name: 'Other', runtime: { minecraft: '1.20.1' } }));
    const calls: string[] = [];
    let releaseFirst: (() => void) | undefined;
    const firstPending = new Promise<void>((resolve) => { releaseFirst = resolve; });
    const { runner } = createRunner({
      sync: async ({ stagePath }) => {
        calls.push(path.basename(stagePath));
        if (calls.length === 1) await firstPending;
      },
    });

    const first = runner.start(request(rootPath));
    const sameInstance = runner.start(request(rootPath));
    const independent = runner.start({ ...request(rootPath), instanceId: 'other-pack' });

    await vi.waitFor(() => expect(calls).toEqual(['updated-pack']));
    expect(runner.get(sameInstance.id)).toMatchObject({ status: 'queued' });
    releaseFirst?.();
    await Promise.all([runner.waitFor(first.id), runner.waitFor(sameInstance.id), runner.waitFor(independent.id)]);
    expect(calls.filter((instanceId) => instanceId === 'updated-pack')).toHaveLength(2);
  });

  it('persists the exact update reconciliation command before a post-publish fault', async () => {
    const rootPath = seedRoot();
    tempDirs.push(rootPath);
    let recorded: unknown;
    const { runner } = createRunner({
      sync: async () => undefined,
      faults: {
        'control-plane': () => {
          recorded = new OperationJournal(rootPath).get(started.id)?.recovery?.canonicalCommand;
          throw new Error('simulated crash after publish');
        },
      },
    });
    const started = runner.start(request(rootPath));

    await expect(runner.waitFor(started.id)).resolves.toMatchObject({ status: 'failed' });
    expect(recorded).toMatchObject({
      version: 1,
      rootPath,
      operationId: started.id,
      command: { version: 1, type: 'reconcile-update', record: { id: 'updated-pack' } },
    });
  });
});

function createRunner(options: Parameters<typeof createUpdateOperationAdapter>[0] = {}) {
  const execute = vi.fn(async (command: InstanceCommand) => ({
    status: 'committed' as const,
    snapshot: command.type === 'reconcile-update'
      ? { selectedId: command.record.id, records: [command.record] }
      : { selectedId: 'updated-pack', records: [record('updated-pack', 'Updated Pack')] },
  }));
  const snapshot = { selectedId: 'updated-pack' as const, records: [record('updated-pack', 'Updated Pack')] };
  return {
    execute,
    runner: new OperationRunner([createUpdateOperationAdapter(options)], {
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

function request(rootPath: string) {
  return { kind: 'update' as const, rootPath, instanceId: 'updated-pack', manifestUrl: 'https://updates.example.com/manifest.json' };
}

function seedRoot(): string {
  const rootPath = fs.mkdtempSync(path.join(os.tmpdir(), 'burrow-update-operation-'));
  const instancePath = path.join(rootPath, 'modpacks', 'updated-pack');
  fs.mkdirSync(instancePath, { recursive: true });
  fs.writeFileSync(path.join(instancePath, 'payload.txt'), 'original bytes');
  fs.writeFileSync(path.join(instancePath, 'modpack.json'), JSON.stringify({ id: 'updated-pack', name: 'Updated Pack', runtime: { minecraft: '1.20.1' }, memory: { maxMb: 4096 }, vmOptions: [] }));
  return rootPath;
}

function capture(rootPath: string): Record<string, string> {
  return Object.fromEntries(['payload.txt', 'modpack.json'].map((file) => [file, fs.readFileSync(path.join(rootPath, 'modpacks', 'updated-pack', file), 'utf8')]));
}

function stubVerifiedManifest(): void {
  const body = Buffer.from('verified bytes');
  const hash = crypto.createHash('sha1').update(body).digest('hex');
  vi.stubGlobal('fetch', vi.fn()
    .mockResolvedValueOnce(manifestResponse({ name: 'Safe', files: [{ path: 'mods/verified.jar', hash, size: body.length, url: 'https://cdn.example.com/verified.jar' }] }))
    .mockResolvedValueOnce(new Response(body, { status: 200, headers: { 'content-length': String(body.length) } })));
}

function manifestResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), { status: 200, headers: { 'content-type': 'application/json' } });
}
