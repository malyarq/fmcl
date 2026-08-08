import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { InstanceReadPort } from '../../../../domains/instances/ports';
import type { CanonicalInstanceRecord, LauncherRoot } from '../../../../domains/instances/instanceTypes';
import { InstanceExporterService, type ArchiveExportContentPort } from '../InstanceExporterService';

const temporaryDirectories: string[] = [];

function makeRoot(): LauncherRoot {
  return {} as LauncherRoot;
}

function makeRecord(): CanonicalInstanceRecord {
  return {
    id: 'exported',
    name: 'Exported pack',
    source: { source: 'local', createdAt: '2026-08-04T00:00:00.000Z', updatedAt: '2026-08-04T00:00:00.000Z' },
    config: { runtime: { minecraftVersion: '1.20.1', modLoader: { type: 'fabric', version: '0.16.0' } } },
    summary: { minecraftVersion: '1.20.1', modLoader: { type: 'fabric', version: '0.16.0' } },
  };
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe('InstanceExporterService', () => {
  it('reads the canonical record through the injected port and writes only through opaque content authority', async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'burrow-exporter-'));
    temporaryDirectories.push(directory);
    const instanceDirectory = path.join(directory, 'instance');
    const outputPath = path.join(directory, 'export.zip');
    fs.mkdirSync(instanceDirectory);
    fs.writeFileSync(path.join(instanceDirectory, 'mod.jar'), 'mod');
    const root = makeRoot();
    const record = makeRecord();
    const read: InstanceReadPort = { read: vi.fn(async () => ({ status: 'ready' as const, snapshot: { selectedId: record.id, records: [record] } })) };
    const content: ArchiveExportContentPort = {
      resolveRoot: vi.fn(async () => root),
      getInstanceDirectory: vi.fn(() => instanceDirectory),
    };
    const service = new InstanceExporterService(read, content);

    await service.exportInstance(directory, record.id, 'multimc', outputPath);

    expect(read.read).toHaveBeenCalledWith(root);
    expect(content.getInstanceDirectory).toHaveBeenCalledWith(root, record.id);
    expect(fs.statSync(outputPath).size).toBeGreaterThan(0);
  });

  it('does not resolve instance content when the canonical record is absent', async () => {
    const root = makeRoot();
    const read: InstanceReadPort = { read: vi.fn(async () => ({ status: 'uninitialized' as const })) };
    const content: ArchiveExportContentPort = {
      resolveRoot: vi.fn(async () => root),
      getInstanceDirectory: vi.fn(),
    };
    const service = new InstanceExporterService(read, content);

    await expect(service.exportInstance('/tmp/burrow-root', 'missing', 'zip', '/tmp/burrow-export.zip')).rejects.toThrow('Instance not found: missing');

    expect(content.getInstanceDirectory).not.toHaveBeenCalled();
  });
});
