import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { OperationJournal } from '../operationJournal';
import { OperationRunner } from '../operationRunner';
import { createDuplicateOperationAdapter } from '../duplicateOperation';
import { createImportOperationAdapter } from '../importOperation';
import { createProviderInstallOperationAdapters } from '../providerInstallOperation';
import { createDeleteOperationAdapter } from '../deleteOperation';
import { createExportOperationAdapter } from '../exportOperation';

describe('operation recovery', () => {
  const tempDirs: string[] = [];
  afterEach(() => { for (const dir of tempDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true }); });

  it('removes proven pre-publish residue but retains an ambiguous published path', async () => {
    const rootPath = fs.mkdtempSync(path.join(os.tmpdir(), 'fmcl-operation-recovery-'));
    tempDirs.push(rootPath);
    const journal = new OperationJournal(rootPath);
    const stagedId = '11111111-1111-4111-8111-111111111111';
    const publishedId = '22222222-2222-4222-8222-222222222222';
    fs.mkdirSync(path.join(rootPath, '.fmcl-operations', 'staging', stagedId), { recursive: true });
    fs.mkdirSync(path.join(rootPath, 'modpacks', 'ambiguous'), { recursive: true });
    fs.writeFileSync(path.join(rootPath, 'modpacks', 'ambiguous', 'payload.txt'), 'do not guess');
    journal.save({ id: stagedId, kind: 'duplicate', rootPath, instanceId: 'source', status: 'running', phase: 'validated', progress: { completed: 0, total: 1 }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), input: { kind: 'duplicate', rootPath, sourceId: 'source' }, recovery: { sourceId: 'source', destinationId: 'staged', destinationName: 'Staged' } });
    journal.save({ id: publishedId, kind: 'duplicate', rootPath, instanceId: 'source', status: 'running', phase: 'published', progress: { completed: 1, total: 1 }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), input: { kind: 'duplicate', rootPath, sourceId: 'source', destinationId: 'ambiguous' }, recovery: { sourceId: 'source', destinationId: 'ambiguous', destinationName: 'Ambiguous' } });

    const runner = new OperationRunner([createDuplicateOperationAdapter()]);
    await runner.recover(rootPath);

    expect(fs.existsSync(path.join(rootPath, '.fmcl-operations', 'staging', stagedId))).toBe(false);
    expect(runner.get(stagedId)).toMatchObject({ status: 'recovered', phase: 'completed' });
    expect(runner.get(publishedId)).toMatchObject({ status: 'recovery-required', phase: 'recovery-required' });
    expect(fs.readFileSync(path.join(rootPath, 'modpacks', 'ambiguous', 'payload.txt'), 'utf8')).toBe('do not guess');
  });

  it('replays a proven published import through the registered adapter without replacing its bytes', async () => {
    const rootPath = fs.mkdtempSync(path.join(os.tmpdir(), 'fmcl-import-recovery-'));
    tempDirs.push(rootPath);
    const journal = new OperationJournal(rootPath);
    const operationId = '33333333-3333-4333-8333-333333333333';
    fs.mkdirSync(path.join(rootPath, 'modpacks', 'imported'), { recursive: true });
    fs.writeFileSync(path.join(rootPath, 'modpacks', 'imported', 'payload.txt'), 'published bytes');
    fs.writeFileSync(path.join(rootPath, 'modpacks', 'imported', 'modpack.json'), JSON.stringify({
      id: 'imported', name: 'Imported', runtime: { minecraft: '1.20.1', modLoader: { type: 'vanilla' } }, memory: { maxMb: 4096 }, vmOptions: [],
    }));
    fs.writeFileSync(path.join(rootPath, 'modpacks.json'), JSON.stringify({ selectedModpack: 'default', modpacks: {} }));
    fs.writeFileSync(path.join(rootPath, 'modpacks-metadata.json'), JSON.stringify({ selectedModpack: 'default', modpacks: {} }));
    journal.save({
      id: operationId, kind: 'import', rootPath, instanceId: 'imported', status: 'running', phase: 'published', progress: { completed: 3, total: 4 },
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      input: { kind: 'import', rootPath, filePath: path.join(rootPath, 'source.zip'), destinationId: 'imported' },
      recovery: { destinationId: 'imported', destinationName: 'Imported', missing: [] },
    });

    const runner = new OperationRunner([createDuplicateOperationAdapter(), createImportOperationAdapter()]);
    await runner.recover(rootPath);

    expect(runner.get(operationId)).toMatchObject({ status: 'recovered', result: { status: 'recovered', instanceId: 'imported' } });
    expect(fs.readFileSync(path.join(rootPath, 'modpacks', 'imported', 'payload.txt'), 'utf8')).toBe('published bytes');
    expect(JSON.parse(fs.readFileSync(path.join(rootPath, 'modpacks.json'), 'utf8'))).toMatchObject({ modpacks: { imported: { name: 'Imported' } } });
  });

  it('replays a proven published provider install through its registered adapter without replacing its bytes', async () => {
    const rootPath = fs.mkdtempSync(path.join(os.tmpdir(), 'fmcl-provider-recovery-'));
    tempDirs.push(rootPath);
    const journal = new OperationJournal(rootPath);
    const operationId = '44444444-4444-4444-8444-444444444444';
    fs.mkdirSync(path.join(rootPath, 'modpacks', 'provider'), { recursive: true });
    fs.writeFileSync(path.join(rootPath, 'modpacks', 'provider', 'payload.txt'), 'published provider bytes');
    fs.writeFileSync(path.join(rootPath, 'modpacks', 'provider', 'modpack.json'), JSON.stringify({
      id: 'provider', name: 'Provider', runtime: { minecraft: '1.20.1', modLoader: { type: 'vanilla' } }, memory: { maxMb: 4096 }, vmOptions: [],
    }));
    fs.writeFileSync(path.join(rootPath, 'modpacks.json'), JSON.stringify({ selectedModpack: 'default', modpacks: {} }));
    fs.writeFileSync(path.join(rootPath, 'modpacks-metadata.json'), JSON.stringify({ selectedModpack: 'default', modpacks: {} }));
    journal.save({
      id: operationId, kind: 'install-modrinth', rootPath, instanceId: 'provider', status: 'running', phase: 'published', progress: { completed: 3, total: 4 },
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      input: { kind: 'install-modrinth', rootPath, projectId: 'project', versionId: 'version', destinationId: 'provider' },
      recovery: { destinationId: 'provider', destinationName: 'Provider', missing: [] },
    });

    const runner = new OperationRunner(createProviderInstallOperationAdapters({
      installers: { curseforge: async () => { throw new Error('not used'); }, modrinth: async () => { throw new Error('not used'); } },
    }));
    await runner.recover(rootPath);

    expect(runner.get(operationId)).toMatchObject({ status: 'recovered', result: { status: 'recovered', instanceId: 'provider' } });
    expect(fs.readFileSync(path.join(rootPath, 'modpacks', 'provider', 'payload.txt'), 'utf8')).toBe('published provider bytes');
  });

  it('restores a pre-commit quarantined delete on restart but preserves ambiguous residue', async () => {
    const rootPath = fs.mkdtempSync(path.join(os.tmpdir(), 'fmcl-delete-recovery-'));
    tempDirs.push(rootPath);
    const journal = new OperationJournal(rootPath);
    const operationId = '55555555-5555-4555-8555-555555555555';
    fs.mkdirSync(path.join(rootPath, '.fmcl-operations', 'backups', operationId, 'modpacks', 'target'), { recursive: true });
    fs.writeFileSync(path.join(rootPath, '.fmcl-operations', 'backups', operationId, 'modpacks', 'target', 'payload.bin'), Buffer.from([0, 1, 2, 255]));
    fs.writeFileSync(path.join(rootPath, '.fmcl-operations', 'backups', operationId, 'modpacks', 'target', 'modpack.json'), JSON.stringify({ id: 'target', name: 'Target', runtime: { minecraft: '1.20.1' }, memory: { maxMb: 4096 }, vmOptions: [] }));
    fs.writeFileSync(path.join(rootPath, 'modpacks.json'), JSON.stringify({ selectedModpack: 'target', modpacks: { target: { name: 'Target' } } }));
    fs.writeFileSync(path.join(rootPath, 'modpacks-metadata.json'), JSON.stringify({ selectedModpack: 'target', modpacks: { target: { id: 'target' } } }));
    journal.save({
      id: operationId, kind: 'delete', rootPath, instanceId: 'target', status: 'running', phase: 'published', progress: { completed: 1, total: 3 },
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), input: { kind: 'delete', rootPath, instanceId: 'target' }, recovery: { destinationId: 'target' },
    });

    const runner = new OperationRunner([createDeleteOperationAdapter()]);
    await runner.recover(rootPath);

    expect(runner.get(operationId)).toMatchObject({ status: 'recovered', result: { status: 'recovered', instanceId: 'target' } });
    expect(fs.readFileSync(path.join(rootPath, 'modpacks', 'target', 'payload.bin'))).toEqual(Buffer.from([0, 1, 2, 255]));
  });

  it('fails closed without cleaning a foreign root when a journal record changes its root paths', async () => {
    const rootPath = fs.mkdtempSync(path.join(os.tmpdir(), 'fmcl-operation-journal-root-a-'));
    const foreignRootPath = fs.mkdtempSync(path.join(os.tmpdir(), 'fmcl-operation-journal-root-b-'));
    tempDirs.push(rootPath, foreignRootPath);
    const operationId = '66666666-6666-4666-8666-666666666666';
    const foreignResidue = path.join(foreignRootPath, '.fmcl-operations', 'staging', operationId, 'preserve.txt');
    fs.mkdirSync(path.dirname(foreignResidue), { recursive: true });
    fs.writeFileSync(foreignResidue, 'do not touch');
    writeRawJournal(rootPath, {
      [operationId]: {
        id: operationId, kind: 'duplicate', rootPath: foreignRootPath, instanceId: 'source', status: 'running', phase: 'validated', progress: { completed: 2, total: 4 },
        createdAt: '2026-08-03T00:00:00.000Z', updatedAt: '2026-08-03T00:00:00.000Z',
        input: { kind: 'duplicate', rootPath: foreignRootPath, sourceId: 'source' },
        recovery: { sourceId: 'source', destinationId: 'target', destinationName: 'Target' },
      },
    });

    await expect(new OperationRunner([createDuplicateOperationAdapter()]).recover(rootPath)).rejects.toThrow(/state and recovery backup are unavailable/i);
    expect(fs.readFileSync(foreignResidue, 'utf8')).toBe('do not touch');
  });

  it('fails closed before archive recovery can follow tampered workspace paths', async () => {
    const rootPath = fs.mkdtempSync(path.join(os.tmpdir(), 'fmcl-operation-journal-archive-a-'));
    const foreignRootPath = fs.mkdtempSync(path.join(os.tmpdir(), 'fmcl-operation-journal-archive-b-'));
    tempDirs.push(rootPath, foreignRootPath);
    const operationId = '77777777-7777-4777-8777-777777777777';
    const outputPath = path.join(rootPath, 'exports', 'export-me.zip');
    const foreignWorkspace = path.join(foreignRootPath, 'malicious-workspace');
    const foreignBackup = path.join(foreignWorkspace, 'previous-output.zip');
    fs.mkdirSync(foreignWorkspace, { recursive: true });
    fs.writeFileSync(foreignBackup, 'foreign archive');
    writeRawJournal(rootPath, {
      [operationId]: {
        id: operationId, kind: 'export', rootPath, instanceId: 'export-me', status: 'running', phase: 'published', progress: { completed: 3, total: 3 },
        createdAt: '2026-08-03T00:00:00.000Z', updatedAt: '2026-08-03T00:00:00.000Z',
        input: { kind: 'export', rootPath, instanceId: 'export-me', format: 'zip', outputPath },
        recovery: { outputPath, workspacePath: foreignWorkspace, stagedPath: path.join(foreignWorkspace, 'archive.zip'), backupPath: foreignBackup, hadOutput: true },
      },
    });

    await expect(new OperationRunner([]).recover(rootPath)).rejects.toThrow(/state and recovery backup are unavailable/i);
    expect(fs.readFileSync(foreignBackup, 'utf8')).toBe('foreign archive');
    expect(fs.existsSync(outputPath)).toBe(false);
  });

  it('does not replay a self-consistent tampered archive output path after restart', async () => {
    const rootPath = fs.mkdtempSync(path.join(os.tmpdir(), 'fmcl-operation-journal-output-a-'));
    const foreignRootPath = fs.mkdtempSync(path.join(os.tmpdir(), 'fmcl-operation-journal-output-b-'));
    tempDirs.push(rootPath, foreignRootPath);
    const operationId = '88888888-8888-4888-8888-888888888888';
    const foreignOutputPath = path.join(foreignRootPath, 'exports', 'victim.zip');
    const foreignWorkspace = path.join(path.dirname(foreignOutputPath), `.${path.basename(foreignOutputPath)}.fmcl-export-${operationId}`);
    const foreignStagedPath = path.join(foreignWorkspace, 'archive.zip');
    const foreignBackupPath = path.join(foreignWorkspace, 'previous-output.zip');
    fs.mkdirSync(foreignWorkspace, { recursive: true });
    fs.mkdirSync(path.dirname(foreignOutputPath), { recursive: true });
    fs.writeFileSync(foreignOutputPath, 'published archive bytes');
    fs.writeFileSync(foreignStagedPath, 'staged archive bytes');
    fs.writeFileSync(foreignBackupPath, 'previous archive bytes');

    writeRawJournal(rootPath, {
      [operationId]: {
        id: operationId, kind: 'export', rootPath, instanceId: 'export-me', status: 'running', phase: 'published', progress: { completed: 3, total: 3 },
        createdAt: '2026-08-03T00:00:00.000Z', updatedAt: '2026-08-03T00:00:00.000Z',
        input: { kind: 'export', rootPath, instanceId: 'export-me', format: 'zip', outputPath: foreignOutputPath },
        recovery: {
          outputPath: foreignOutputPath,
          workspacePath: foreignWorkspace,
          stagedPath: foreignStagedPath,
          backupPath: foreignBackupPath,
          hadOutput: true,
          digest: createHash('sha256').update('published archive bytes').digest('hex'),
        },
      },
    });

    const runner = new OperationRunner([createExportOperationAdapter()]);
    await expect(runner.recover(rootPath)).resolves.toBeUndefined();

    expect(runner.get(operationId)).toMatchObject({ status: 'recovery-required', phase: 'recovery-required' });
    expect(fs.readFileSync(foreignOutputPath, 'utf8')).toBe('published archive bytes');
    expect(fs.readFileSync(foreignStagedPath, 'utf8')).toBe('staged archive bytes');
    expect(fs.readFileSync(foreignBackupPath, 'utf8')).toBe('previous archive bytes');
    expect(fs.existsSync(foreignWorkspace)).toBe(true);
  });
});

function writeRawJournal(rootPath: string, operations: Record<string, unknown>): void {
  const journalPath = path.join(rootPath, '.fmcl-operations', 'journal.json');
  fs.mkdirSync(path.dirname(journalPath), { recursive: true });
  fs.writeFileSync(journalPath, JSON.stringify({ operations, _fmclSchemaVersion: 1 }));
}
