import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ZipFile } from 'yazl';
import { afterEach, describe, expect, it } from 'vitest';
import { createImportOperationAdapter } from '../importOperation';
import { createProviderInstallOperationAdapters } from '../providerInstallOperation';
import { OperationRunner } from '../operationRunner';
import { createUpdateOperationAdapter } from '../updateOperation';
import { createDeleteOperationAdapter } from '../deleteOperation';
import { createExportOperationAdapter } from '../exportOperation';

describe('OperationRunner import registry', () => {
  const tempDirs: string[] = [];
  afterEach(() => { for (const dir of tempDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true }); });

  it('routes start({ kind: import }) to the registered staged archive adapter', async () => {
    const rootPath = fs.mkdtempSync(path.join(os.tmpdir(), 'fmcl-import-registry-'));
    tempDirs.push(rootPath);
    fs.mkdirSync(path.join(rootPath, 'modpacks'), { recursive: true });
    fs.writeFileSync(path.join(rootPath, 'modpacks.json'), JSON.stringify({ selectedModpack: 'default', modpacks: {} }));
    fs.writeFileSync(path.join(rootPath, 'modpacks-metadata.json'), JSON.stringify({ selectedModpack: 'default', modpacks: {} }));
    const archivePath = await writeArchive(rootPath);
    const runner = new OperationRunner([createImportOperationAdapter()]);

    const started = runner.start({ kind: 'import', rootPath, filePath: archivePath, destinationId: 'registry-import' });
    const completed = await runner.waitFor(started.id);

    expect(completed).toMatchObject({
      kind: 'import',
      status: 'succeeded',
      result: { status: 'succeeded', instanceId: 'registry-import' },
    });
  });

  it.each(['install-curseforge', 'install-modrinth'] as const)('routes start({ kind: %s }) to the registered provider adapter', async (kind) => {
    const rootPath = fs.mkdtempSync(path.join(os.tmpdir(), 'fmcl-provider-registry-'));
    tempDirs.push(rootPath);
    fs.mkdirSync(path.join(rootPath, 'modpacks'), { recursive: true });
    fs.writeFileSync(path.join(rootPath, 'modpacks.json'), JSON.stringify({ selectedModpack: 'default', modpacks: {} }));
    fs.writeFileSync(path.join(rootPath, 'modpacks-metadata.json'), JSON.stringify({ selectedModpack: 'default', modpacks: {} }));
    const runner = new OperationRunner(createProviderInstallOperationAdapters({
      installers: {
        curseforge: async ({ rootPath: stageRoot, destinationId }) => stage(stageRoot, destinationId),
        modrinth: async ({ rootPath: stageRoot, destinationId }) => stage(stageRoot, destinationId),
      },
    }));

    const started = runner.start(kind === 'install-curseforge'
      ? { kind, rootPath, projectId: 1, fileId: 2, destinationId: 'provider' }
      : { kind, rootPath, projectId: 'provider', versionId: 'version', destinationId: 'provider' });
    const completed = await runner.waitFor(started.id);

    expect(completed).toMatchObject({ kind, status: 'succeeded', result: { status: 'succeeded', instanceId: 'provider' } });
  });

  it('routes start({ kind: update }) to the registered staged manifest adapter', async () => {
    const rootPath = fs.mkdtempSync(path.join(os.tmpdir(), 'fmcl-update-registry-'));
    tempDirs.push(rootPath);
    fs.mkdirSync(path.join(rootPath, 'modpacks', 'updated-pack'), { recursive: true });
    fs.writeFileSync(path.join(rootPath, 'modpacks', 'updated-pack', 'modpack.json'), JSON.stringify({ id: 'updated-pack', name: 'Updated', runtime: { minecraft: '1.20.1' } }));
    const runner = new OperationRunner([createUpdateOperationAdapter({ sync: async () => undefined })]);

    const started = runner.start({ kind: 'update', rootPath, instanceId: 'updated-pack', manifestUrl: 'https://updates.example.com/manifest.json' });

    await expect(runner.waitFor(started.id)).resolves.toMatchObject({ kind: 'update', status: 'succeeded', result: { status: 'succeeded', instanceId: 'updated-pack' } });
  });

  it('routes start({ kind: delete }) to the registered quarantine adapter', async () => {
    const rootPath = fs.mkdtempSync(path.join(os.tmpdir(), 'fmcl-delete-registry-'));
    tempDirs.push(rootPath);
    fs.mkdirSync(path.join(rootPath, 'modpacks', 'delete-me'), { recursive: true });
    fs.writeFileSync(path.join(rootPath, 'modpacks', 'delete-me', 'modpack.json'), JSON.stringify({ id: 'delete-me', name: 'Delete me', runtime: { minecraft: '1.20.1' }, memory: { maxMb: 4096 }, vmOptions: [] }));
    fs.writeFileSync(path.join(rootPath, 'modpacks.json'), JSON.stringify({ selectedModpack: 'delete-me', modpacks: { 'delete-me': { name: 'Delete me' } } }));
    fs.writeFileSync(path.join(rootPath, 'modpacks-metadata.json'), JSON.stringify({ selectedModpack: 'delete-me', modpacks: { 'delete-me': { id: 'delete-me' } } }));
    const runner = new OperationRunner([createDeleteOperationAdapter()]);

    const started = runner.start({ kind: 'delete', rootPath, instanceId: 'delete-me' });
    await expect(runner.waitFor(started.id)).resolves.toMatchObject({ kind: 'delete', status: 'succeeded', result: { status: 'succeeded', instanceId: 'delete-me' } });
  });

  it('routes archive and manifest export variants to the registered staged adapter', async () => {
    const rootPath = fs.mkdtempSync(path.join(os.tmpdir(), 'fmcl-export-registry-'));
    tempDirs.push(rootPath);
    const sourcePath = path.join(rootPath, 'modpacks', 'export-me');
    fs.mkdirSync(sourcePath, { recursive: true });
    fs.writeFileSync(path.join(sourcePath, 'payload.txt'), 'archive bytes');
    const outputPath = path.join(rootPath, 'export.zip');
    const runner = new OperationRunner([createExportOperationAdapter()]);

    const started = runner.start({ kind: 'export', rootPath, instanceId: 'export-me', format: 'zip', outputPath });

    await expect(runner.waitFor(started.id)).resolves.toMatchObject({
      kind: 'export', status: 'succeeded', result: { status: 'succeeded', instanceId: 'export-me' },
    });
    expect(fs.statSync(outputPath).size).toBeGreaterThan(0);

    fs.writeFileSync(path.join(sourcePath, 'modpack.json'), JSON.stringify({
      id: 'export-me', name: 'Export me', runtime: { minecraft: '1.20.1', modLoader: { type: 'vanilla' } },
      memory: { maxMb: 4096 }, vmOptions: [], createdAt: '2026-08-03T00:00:00.000Z', updatedAt: '2026-08-03T00:00:00.000Z',
    }));
    fs.writeFileSync(path.join(rootPath, 'modpacks-metadata.json'), JSON.stringify({ selectedModpack: 'export-me', modpacks: {} }));
    const manifestStarted = runner.start({
      kind: 'export', rootPath, instanceId: 'export-me', format: 'manifest', name: 'Exported manifest', version: '1.0.0',
    });
    await expect(runner.waitFor(manifestStarted.id)).resolves.toMatchObject({
      kind: 'export', status: 'succeeded', result: { status: 'succeeded', instanceId: 'export-me' },
    });
    expect(JSON.parse(fs.readFileSync(path.join(sourcePath, 'manifest.json'), 'utf8'))).toMatchObject({ name: 'Exported manifest' });
  });
});

function stage(rootPath: string, destinationId: string) {
  const config = { id: destinationId, name: 'Provider', runtime: { minecraft: '1.20.1', modLoader: { type: 'vanilla' as const } }, memory: { maxMb: 4096 }, vmOptions: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  fs.mkdirSync(path.join(rootPath, 'modpacks', destinationId), { recursive: true });
  fs.writeFileSync(path.join(rootPath, 'modpacks', destinationId, 'modpack.json'), JSON.stringify(config));
  return { config, metadata: { id: destinationId, name: 'Provider' }, missing: [] };
}

async function writeArchive(rootPath: string): Promise<string> {
  const archivePath = path.join(rootPath, 'import.zip');
  const zip = new ZipFile();
  zip.addBuffer(Buffer.from(JSON.stringify({ components: [{ uid: 'net.minecraft', version: '1.20.1' }] })), 'mmc-pack.json');
  zip.addBuffer(Buffer.from('safe'), '.minecraft/config/options.txt');
  await new Promise<void>((resolve, reject) => {
    zip.outputStream.pipe(fs.createWriteStream(archivePath)).once('close', resolve).once('error', reject);
    zip.end();
  });
  return archivePath;
}
