import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ModpackService } from '../instanceService';
import { loadModpacksMetadata, saveModpacksMetadata } from '../../modpacks/storage';
import type { ModpackMetadata } from '../../../../shared/types/modpack';

function createRootDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'fmcl-instance-metadata-'));
}

function createSeedMetadata(id: string, name: string): ModpackMetadata {
  return {
    id,
    name,
    version: '2.5.0',
    source: 'modrinth',
    sourceId: 'original-project',
    sourceVersionId: 'version-42',
    minecraftVersion: '1.20.1',
    modLoader: { type: 'fabric', version: '0.16.0' },
    iconUrl: 'https://cdn.example/icon.png',
    description: 'Adventure with preserved metadata',
    author: 'FMCL',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-02T00:00:00.000Z',
  };
}

describe('ModpackService metadata CRUD', () => {
  const service = new ModpackService();
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
    tempDirs.length = 0;
  });

  it('keeps metadata name in sync when renaming a modpack', () => {
    const rootDir = createRootDir();
    tempDirs.push(rootDir);

    const created = service.createModpack(rootDir, 'Original Pack', {
      runtime: { minecraft: '1.20.1', modLoader: { type: 'fabric', version: '0.16.0' } },
    });
    const seededMetadata = createSeedMetadata(created.id, created.config.name);
    saveModpacksMetadata(rootDir, {
      selectedModpack: created.id,
      modpacks: {
        [created.id]: seededMetadata,
      },
    });

    service.renameModpack(rootDir, created.id, 'Renamed Pack');

    const metadata = loadModpacksMetadata(rootDir).modpacks[created.id];
    expect(metadata).toMatchObject({
      id: created.id,
      name: 'Renamed Pack',
      description: seededMetadata.description,
      iconUrl: seededMetadata.iconUrl,
      source: seededMetadata.source,
      sourceId: seededMetadata.sourceId,
      sourceVersionId: seededMetadata.sourceVersionId,
    });
    expect(metadata.updatedAt).not.toBe(seededMetadata.updatedAt);
  });

  it('duplicates metadata for the new modpack id without dropping source fields', () => {
    const rootDir = createRootDir();
    tempDirs.push(rootDir);

    const created = service.createModpack(rootDir, 'Original Pack', {
      runtime: { minecraft: '1.20.1', modLoader: { type: 'fabric', version: '0.16.0' } },
    });
    const seededMetadata = createSeedMetadata(created.id, created.config.name);
    saveModpacksMetadata(rootDir, {
      selectedModpack: created.id,
      modpacks: {
        [created.id]: seededMetadata,
      },
    });

    const duplicated = service.duplicateModpack(rootDir, created.id, 'Original Pack Copy');
    const metadataIndex = loadModpacksMetadata(rootDir);
    const duplicatedMetadata = metadataIndex.modpacks[duplicated.id];

    expect(metadataIndex.selectedModpack).toBe(duplicated.id);
    expect(duplicatedMetadata).toMatchObject({
      id: duplicated.id,
      name: 'Original Pack Copy',
      version: seededMetadata.version,
      source: seededMetadata.source,
      sourceId: seededMetadata.sourceId,
      sourceVersionId: seededMetadata.sourceVersionId,
      iconUrl: seededMetadata.iconUrl,
      description: seededMetadata.description,
      author: seededMetadata.author,
      minecraftVersion: seededMetadata.minecraftVersion,
    });
    expect(duplicatedMetadata.createdAt).not.toBe(seededMetadata.createdAt);
    expect(duplicatedMetadata.updatedAt).not.toBe(seededMetadata.updatedAt);
  });
});
