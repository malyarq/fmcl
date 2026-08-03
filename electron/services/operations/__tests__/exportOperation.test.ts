import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { createExportOperationAdapter } from '../exportOperation';
import { OperationRunner } from '../operationRunner';

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
    expect(fs.readdirSync(path.dirname(outputPath)).some((name) => name.includes('.fmcl-export-'))).toBe(false);
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

  it('stages a manifest and commits metadata only after publishing the verified instance copy', async () => {
    const rootPath = seedManifestInstance(tempDirs);
    const runner = new OperationRunner([createExportOperationAdapter()]);

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
    expect(JSON.parse(fs.readFileSync(path.join(rootPath, 'modpacks-metadata.json'), 'utf8'))).toMatchObject({
      modpacks: { 'export-me': { name: 'Published pack', version: '2.0.0', author: 'Friend' } },
    });
    expect(fs.existsSync(path.join(rootPath, 'modpacks', 'export-me', '.fmcl-operation-publish.json'))).toBe(false);
  });

  it.each(['validation', 'publish', 'control-plane'] as const)('never mutates live manifest or metadata when %s fails', async (fault) => {
    const rootPath = seedManifestInstance(tempDirs);
    const runner = new OperationRunner([createExportOperationAdapter({
      faults: { [fault]: () => { throw new Error(`${fault} failed`); } },
    })]);

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
    const runner = new OperationRunner([createExportOperationAdapter({
      hooks: { afterBackup: () => { cancel?.(); } },
    })]);
    const started = runner.start(manifestRequest(rootPath));
    cancel = () => runner.cancel(started.id);

    await expect(runner.waitFor(started.id)).resolves.toMatchObject({ status: 'cancelled', result: { status: 'cancelled' } });
    expect(fs.readFileSync(path.join(rootPath, 'modpacks', 'export-me', 'manifest.json'), 'utf8')).toBe('{"old":true}');
    expect(JSON.parse(fs.readFileSync(path.join(rootPath, 'modpacks-metadata.json'), 'utf8'))).toMatchObject({
      modpacks: { 'export-me': { name: 'Old pack', version: '1.0.0' } },
    });
  });

  it('has no legacy mutable manifest IPC chain', () => {
    const projectRoot = fileURLToPath(new URL('../../../../', import.meta.url));
    for (const relativePath of [
      'shared/contracts/modpacks.ts',
      'shared/contracts/ipcChannels.ts',
      'electron/ipc/handlers/modpacksHandlers.ts',
      'electron/preload/bridges/ModpacksBridge.ts',
      'src/services/ipc/modpacksIPC.ts',
      'src/verification/manual/mockEnvironment.ts',
      'docs/en/contracts-map.md',
      'docs/ru/contracts-map.md',
    ]) {
      expect(fs.readFileSync(path.join(projectRoot, relativePath), 'utf8')).not.toContain('exportFromInstance');
    }
  });
});

function request(rootPath: string, outputPath: string) {
  return { kind: 'export' as const, rootPath, instanceId: 'export-me', format: 'zip' as const, outputPath };
}

function seedOutput(tempDirs: string[]): { rootPath: string; outputPath: string } {
  const rootPath = fs.mkdtempSync(path.join(os.tmpdir(), 'fmcl-export-operation-'));
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
  const rootPath = fs.mkdtempSync(path.join(os.tmpdir(), 'fmcl-manifest-export-operation-'));
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
