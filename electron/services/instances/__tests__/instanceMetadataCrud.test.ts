import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ModpackService } from '../instanceService';
import { loadModpacksMetadata, saveModpacksMetadata } from '../../modpacks/storage';
import type { ModpackMetadata } from '../../../../shared/types/modpack';
import { getModpackConfigPath, getModpacksIndexPath } from '../paths';

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
    vi.restoreAllMocks();
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

  it('rebuilds a missing selected modpack config from persisted metadata truth instead of stale defaults', () => {
    const rootDir = createRootDir();
    tempDirs.push(rootDir);

    const created = service.createModpack(rootDir, 'Original Pack', {
      runtime: { minecraft: '1.20.1', modLoader: { type: 'fabric', version: '0.16.0' } },
    });
    const seededMetadata = {
      ...createSeedMetadata(created.id, 'Recovered Pack'),
      minecraftVersion: '1.21.1',
      modLoader: { type: 'neoforge' as const, version: '21.1.1' },
    };
    saveModpacksMetadata(rootDir, {
      selectedModpack: created.id,
      modpacks: {
        [created.id]: seededMetadata,
      },
    });

    fs.rmSync(getModpackConfigPath(rootDir, created.id), { force: true });

    const recovered = service.loadModpackConfig(rootDir, created.id);
    const persisted = JSON.parse(
      fs.readFileSync(getModpackConfigPath(rootDir, created.id), 'utf-8'),
    ) as { runtime: { minecraft: string; modLoader?: { type: string } }; name: string };

    expect(recovered.name).toBe('Recovered Pack');
    expect(recovered.runtime).toEqual({
      minecraft: '1.21.1',
      modLoader: { type: 'neoforge', version: '21.1.1' },
    });
    expect(persisted.name).toBe('Recovered Pack');
    expect(persisted.runtime).toEqual({
      minecraft: '1.21.1',
      modLoader: { type: 'neoforge', version: '21.1.1' },
    });
  });

  it('preserves an existing default config when rebuilding a missing index', () => {
    const rootDir = createRootDir();
    tempDirs.push(rootDir);

    const initial = service.bootstrapModpacks(rootDir, {
      name: 'Primary Pack',
      runtime: { minecraft: '1.21.1', modLoader: { type: 'fabric', version: '0.16.0' } },
    });

    fs.rmSync(getModpacksIndexPath(rootDir), { force: true });

    const bootstrapped = service.bootstrapModpacks(rootDir);

    expect(bootstrapped.selectedId).toBe('default');
    expect(initial.selectedId).toBe('default');
    expect(bootstrapped.config.name).toBe('Primary Pack');
    expect(bootstrapped.config.runtime).toEqual({
      minecraft: '1.21.1',
      modLoader: { type: 'fabric', version: '0.16.0' },
    });
  });

  it('does not replace a malformed modpacks index with a default index', () => {
    const rootDir = createRootDir();
    tempDirs.push(rootDir);
    const indexPath = getModpacksIndexPath(rootDir);
    fs.writeFileSync(indexPath, '{broken index');
    const original = fs.readFileSync(indexPath);

    expect(() => service.loadModpacksIndex(rootDir)).toThrow(/recovery backup are unavailable/);
    expect(fs.readFileSync(indexPath)).toEqual(original);
  });

  it('rejects a syntactically valid index with a non-record modpack registry', () => {
    const rootDir = createRootDir();
    tempDirs.push(rootDir);
    const indexPath = getModpacksIndexPath(rootDir);
    fs.writeFileSync(indexPath, JSON.stringify({
      _fmclSchemaVersion: 1,
      selectedModpack: 'default',
      modpacks: [],
    }));
    const original = fs.readFileSync(indexPath);

    expect(() => service.loadModpacksIndex(rootDir)).toThrow(/recovery backup are unavailable/);
    expect(fs.readFileSync(indexPath)).toEqual(original);
  });

  it('does not reconstruct defaults over a malformed modpack config', () => {
    const rootDir = createRootDir();
    tempDirs.push(rootDir);
    const created = service.createModpack(rootDir, 'Important Pack');
    const configPath = getModpackConfigPath(rootDir, created.id);
    fs.writeFileSync(configPath, '{broken config');
    const original = fs.readFileSync(configPath);

    expect(() => service.loadModpackConfig(rootDir, created.id)).toThrow(/recovery backup are unavailable/);
    expect(fs.readFileSync(configPath)).toEqual(original);
  });

  it('rejects a syntactically valid config with a malformed runtime', () => {
    const rootDir = createRootDir();
    tempDirs.push(rootDir);
    const created = service.createModpack(rootDir, 'Important Pack');
    const configPath = getModpackConfigPath(rootDir, created.id);
    fs.writeFileSync(configPath, JSON.stringify({
      _fmclSchemaVersion: 1,
      id: created.id,
      name: 'Important Pack',
      runtime: [],
    }));
    const original = fs.readFileSync(configPath);

    expect(() => service.loadModpackConfig(rootDir, created.id)).toThrow(/recovery backup are unavailable/);
    expect(fs.readFileSync(configPath)).toEqual(original);
  });

});
