import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createDeleteOperationAdapter } from '../deleteOperation';
import { OperationRunner } from '../operationRunner';

describe('delete operation', () => {
  const tempDirs: string[] = [];
  afterEach(() => { for (const dir of tempDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true }); });

  it('quarantines the instance, commits both control-plane files, then removes only the contained quarantine', async () => {
    const rootPath = makeRoot(tempDirs);
    const runner = new OperationRunner([createDeleteOperationAdapter()]);

    const started = runner.start({ kind: 'delete', rootPath, instanceId: 'target' });
    await expect(runner.waitFor(started.id)).resolves.toMatchObject({
      kind: 'delete',
      status: 'succeeded',
      result: { status: 'succeeded', instanceId: 'target' },
    });

    expect(fs.existsSync(path.join(rootPath, 'modpacks', 'target'))).toBe(false);
    expect(fs.existsSync(path.join(rootPath, '.fmcl-operations', 'backups', started.id))).toBe(false);
    expect(readJson(rootPath, 'modpacks.json')).toMatchObject({ selectedModpack: 'source', modpacks: { source: { name: 'Source' } } });
    expect(readJson(rootPath, 'modpacks-metadata.json')).toMatchObject({ selectedModpack: 'source', modpacks: { source: { id: 'source' } } });
  });

  it.each(['quarantine', 'index', 'metadata'] as const)('restores bytes and control-plane files when %s fails before commit', async (fault) => {
    const rootPath = makeRoot(tempDirs);
    const before = capture(rootPath);
    const runner = new OperationRunner([createDeleteOperationAdapter({ faults: { [fault]: () => { throw new Error(`${fault} failed`); } } })]);

    const started = runner.start({ kind: 'delete', rootPath, instanceId: 'target' });
    await expect(runner.waitFor(started.id)).resolves.toMatchObject({ status: 'failed', result: { status: 'failed' } });

    expect(capture(rootPath)).toEqual(before);
    expect(fs.existsSync(path.join(rootPath, '.fmcl-operations', 'backups', started.id))).toBe(false);
  });

  it('restores the quarantined directory when cancellation arrives before the control-plane commit', async () => {
    const rootPath = makeRoot(tempDirs);
    const before = capture(rootPath);
    let cancel: (() => boolean) | undefined;
    const runner = new OperationRunner([createDeleteOperationAdapter({ hooks: {
      afterQuarantine: () => { cancel?.(); },
    } })]);
    const started = runner.start({ kind: 'delete', rootPath, instanceId: 'target' });
    cancel = () => runner.cancel(started.id);

    await expect(runner.waitFor(started.id)).resolves.toMatchObject({ status: 'cancelled', result: { status: 'cancelled' } });
    expect(capture(rootPath)).toEqual(before);
  });

  it('keeps the contained quarantine as recovery-required when cleanup fails after control-plane commit', async () => {
    const rootPath = makeRoot(tempDirs);
    const runner = new OperationRunner([createDeleteOperationAdapter({ faults: {
      cleanup: () => { throw new Error('cleanup failed'); },
    } })]);

    const started = runner.start({ kind: 'delete', rootPath, instanceId: 'target' });
    await expect(runner.waitFor(started.id)).resolves.toMatchObject({ status: 'recovery-required', result: { status: 'recovery-required' } });

    expect(fs.existsSync(path.join(rootPath, 'modpacks', 'target'))).toBe(false);
    expect(fs.readFileSync(path.join(rootPath, '.fmcl-operations', 'backups', started.id, 'modpacks', 'target', 'payload.bin'))).toEqual(Buffer.from([0, 1, 2, 255]));
    expect(readJson(rootPath, 'modpacks.json').modpacks).not.toHaveProperty('target');
  });

  it('serializes same-instance deletes while the first operation is quarantined', async () => {
    const rootPath = makeRoot(tempDirs);
    let release: (() => void) | undefined;
    const waitForRelease = new Promise<void>((resolve) => { release = resolve; });
    let quarantined: (() => void) | undefined;
    const firstQuarantined = new Promise<void>((resolve) => { quarantined = resolve; });
    let calls = 0;
    const runner = new OperationRunner([createDeleteOperationAdapter({ hooks: {
      afterQuarantine: async () => {
        calls += 1;
        quarantined?.();
        if (calls === 1) await waitForRelease;
      },
    } })]);

    const first = runner.start({ kind: 'delete', rootPath, instanceId: 'target' });
    const second = runner.start({ kind: 'delete', rootPath, instanceId: 'target' });
    await firstQuarantined;

    expect(runner.get(second.id)).toMatchObject({ status: 'queued' });
    release?.();
    await expect(runner.waitFor(first.id)).resolves.toMatchObject({ status: 'succeeded' });
    await expect(runner.waitFor(second.id)).resolves.toMatchObject({ status: 'failed' });
  });
});

function makeRoot(tempDirs: string[]): string {
  const rootPath = fs.mkdtempSync(path.join(os.tmpdir(), 'fmcl-delete-operation-'));
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

function readJson(rootPath: string, fileName: string): { selectedModpack?: string; modpacks: Record<string, unknown> } {
  return JSON.parse(fs.readFileSync(path.join(rootPath, fileName), 'utf8')) as { selectedModpack?: string; modpacks: Record<string, unknown> };
}
