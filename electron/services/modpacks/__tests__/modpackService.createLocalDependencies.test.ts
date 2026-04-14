import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ModpackManifest } from '@shared/types/modpack';
import type { ModPlatformService } from '../../mods/platform/modPlatformService';

const mocked = vi.hoisted(() => ({
  appGetPath: vi.fn<(name: string) => string>(),
}));

vi.mock('electron', () => ({
  app: {
    getPath: mocked.appGetPath,
  },
}));

import { ModpackService } from '../modpackService';

function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'fmcl-modpack-deps-'));
}

describe('ModpackService local dependency truth', () => {
  const tempDirs: string[] = [];

  beforeEach(() => {
    mocked.appGetPath.mockReset();
    mocked.appGetPath.mockImplementation(() => createTempDir());
  });

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('writes exact loader ids for local manifests when the loader version is not known yet', () => {
    const rootPath = createTempDir();
    tempDirs.push(rootPath);

    const service = new ModpackService();
    const { id } = service.createLocalModpack(
      rootPath,
      'Alpha Pack',
      '1.0.0',
      '1.20.1',
      { type: 'forge', version: undefined },
    );

    const manifestPath = path.join(rootPath, 'modpacks', id, 'manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as ModpackManifest;

    expect(manifest.minecraft.modLoaders).toEqual([{ id: 'forge', primary: true }]);
  });

  it('parses exact loader ids from imported manifests without inventing empty versions', async () => {
    const rootPath = createTempDir();
    tempDirs.push(rootPath);

    const service = new ModpackService();
    const manifest: ModpackManifest = {
      formatVersion: 1,
      minecraft: {
        version: '1.20.1',
        modLoaders: [{ id: 'neoforge', primary: true }],
      },
      name: 'Imported Pack',
      version: '2.0.0',
      files: [],
    };

    const result = await service.createFromManifest(
      rootPath,
      manifest,
      {} as ModPlatformService,
    );

    const config = service.loadModpackConfig(rootPath, result.id);
    const createdManifestPath = path.join(rootPath, 'modpacks', result.id, 'manifest.json');
    const createdManifest = JSON.parse(fs.readFileSync(createdManifestPath, 'utf-8')) as ModpackManifest;

    expect(config.runtime.modLoader).toEqual({ type: 'neoforge' });
    expect(createdManifest.minecraft.modLoaders).toEqual([{ id: 'neoforge', primary: true }]);
  });
});
