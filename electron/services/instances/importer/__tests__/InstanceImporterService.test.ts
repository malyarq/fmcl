import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { InstanceApplication } from '../../../../domains/instances/instanceApplication';
import type { CanonicalInstanceRecord, LauncherRoot } from '../../../../domains/instances/instanceTypes';
import type { ArchiveImportContentPort } from '../InstanceImporterService';

const archivePolicy = vi.hoisted(() => ({ openValidatedZip: vi.fn() }));

vi.mock('electron', () => ({ app: { getPath: () => '/tmp/fmcl-importer-default' } }));

vi.mock('../../../../security/archivePolicy', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../../../security/archivePolicy')>();
  return { ...original, openValidatedZip: archivePolicy.openValidatedZip };
});

import { InstanceImporterService } from '../InstanceImporterService';

const temporaryDirectories: string[] = [];

function makeRoot(): LauncherRoot {
  return {} as LauncherRoot;
}

function makeRecord(id = 'imported'): CanonicalInstanceRecord {
  return {
    id,
    name: 'Imported pack',
    source: { source: 'local', createdAt: '2026-08-04T00:00:00.000Z', updatedAt: '2026-08-04T00:00:00.000Z' },
    config: { runtime: { minecraftVersion: '1.20.1' } },
    summary: { minecraftVersion: '1.20.1' },
  };
}

function makeZip() {
  const manifest = { fileName: 'mmc-pack.json' };
  return {
    getEntry: vi.fn((name: string) => name === 'mmc-pack.json' ? manifest : undefined),
    getEntries: vi.fn(() => [manifest]),
    getData: vi.fn(async () => Buffer.from(JSON.stringify({ components: [{ uid: 'net.minecraft', version: '1.20.1' }] }))),
    openReadStream: vi.fn(),
    close: vi.fn(),
  };
}

function makeContent(root: LauncherRoot, overrides: Partial<ArchiveImportContentPort> = {}): ArchiveImportContentPort {
  return {
    resolveRoot: vi.fn(async () => root),
    inspectArchive: vi.fn(async () => ({ format: null })),
    importArchive: vi.fn(async () => ({ id: 'provider-import' })),
    getInstanceDirectory: vi.fn(() => '/tmp/fmcl-import-target'),
    publishInstance: vi.fn(async () => undefined),
    removeInstance: vi.fn(async () => undefined),
    ...overrides,
  };
}

afterEach(() => {
  archivePolicy.openValidatedZip.mockReset();
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe('InstanceImporterService', () => {
  it('rejects an unapproved archive path before archive inspection', async () => {
    const root = makeRoot();
    const content = makeContent(root);
    const application = { execute: vi.fn() } as unknown as InstanceApplication;
    const service = new InstanceImporterService(application, content);

    await expect(service.importInstance('/tmp/fmcl-root', 'relative.zip')).rejects.toThrow('Modpack import path must be an absolute path');

    expect(content.inspectArchive).not.toHaveBeenCalled();
    expect(archivePolicy.openValidatedZip).not.toHaveBeenCalled();
  });

  it('creates a MultiMC instance through the injected canonical application and opaque content port', async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'fmcl-importer-'));
    temporaryDirectories.push(directory);
    const archivePath = path.join(directory, 'pack.zip');
    fs.writeFileSync(archivePath, 'archive');
    const root = makeRoot();
    const record = makeRecord();
    const application = {
      execute: vi.fn(async () => ({ status: 'committed', snapshot: { selectedId: record.id, records: [record] } })),
    } as unknown as InstanceApplication;
    const instanceDirectory = path.join(directory, 'modpacks', record.id);
    fs.mkdirSync(instanceDirectory, { recursive: true });
    const content = makeContent(root, { getInstanceDirectory: vi.fn(() => instanceDirectory) });
    const zip = makeZip();
    archivePolicy.openValidatedZip.mockResolvedValue(zip);
    const service = new InstanceImporterService(application, content);

    await expect(service.importInstance(directory, archivePath, 'Imported pack')).resolves.toBe(record.id);

    expect(application.execute).toHaveBeenCalledWith(root, expect.objectContaining({ type: 'create', name: 'Imported pack' }));
    expect(content.publishInstance).toHaveBeenCalledWith(root, record);
    expect(content.getInstanceDirectory).toHaveBeenCalledWith(root, record.id);
  });

  it('removes canonical and staged content when publication fails', async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'fmcl-importer-'));
    temporaryDirectories.push(directory);
    const archivePath = path.join(directory, 'pack.zip');
    fs.writeFileSync(archivePath, 'archive');
    const root = makeRoot();
    const record = makeRecord('cleanup-id');
    const application = {
      execute: vi.fn()
        .mockResolvedValueOnce({ status: 'committed', snapshot: { selectedId: record.id, records: [record] } })
        .mockResolvedValueOnce({ status: 'committed', snapshot: { selectedId: null, records: [] } }),
    } as unknown as InstanceApplication;
    const instanceDirectory = path.join(directory, 'modpacks', record.id);
    fs.mkdirSync(instanceDirectory, { recursive: true });
    const content = makeContent(root, {
      getInstanceDirectory: vi.fn(() => instanceDirectory),
      publishInstance: vi.fn(async () => { throw new Error('publish failed'); }),
    });
    archivePolicy.openValidatedZip.mockResolvedValue(makeZip());
    const service = new InstanceImporterService(application, content);

    await expect(service.importInstance(directory, archivePath)).rejects.toThrow('publish failed');

    expect(application.execute).toHaveBeenLastCalledWith(root, { version: 1, type: 'delete', id: record.id });
    expect(content.removeInstance).toHaveBeenCalledWith(root, record.id);
  });
});
