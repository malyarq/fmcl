import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ModpackManifest } from '@shared/types/modpack';
import type { ModPlatformService } from '../../mods/platform/modPlatformService';
import type { ContentManager } from '../../content/contentManager';

const mocked = vi.hoisted(() => ({
  appGetPath: vi.fn<(name: string) => string>(),
  queueAdd: vi.fn<
    (run: () => Promise<void>, priority?: number, id?: string) => Promise<void>
  >(),
  downloadSingle: vi.fn<
    (url: string | string[], dest: string, options?: unknown) => Promise<void>
  >(),
}));

vi.mock('electron', () => ({
  app: {
    getPath: mocked.appGetPath,
  },
}));

vi.mock('../../download/downloadQueue', () => ({
  downloadQueue: {
    add: mocked.queueAdd,
  },
}));

vi.mock('../../download/downloadManager', () => ({
  DownloadManager: {
    downloadSingle: mocked.downloadSingle,
  },
}));

import { ModpackService } from '../modpackService';

function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'fmcl-modpack-service-'));
}

describe('ModpackService', () => {
  const tempDirs: string[] = [];

  beforeEach(() => {
    mocked.appGetPath.mockReset();
    mocked.appGetPath.mockImplementation(() => createTempDir());

    mocked.queueAdd.mockReset();
    mocked.queueAdd.mockImplementation(async (run) => run());

    mocked.downloadSingle.mockReset();
    mocked.downloadSingle.mockImplementation(async (_url, destination) => {
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.writeFileSync(destination, 'downloaded');
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();

    for (const dir of tempDirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('writes override files and marks the manifest as having overrides', () => {
    const rootPath = createTempDir();
    tempDirs.push(rootPath);

    const service = new ModpackService();
    const { id } = service.createLocalModpack(
      rootPath,
      'Example Pack',
      '1.2.3',
      '1.20.1',
      { type: 'fabric', version: '0.15.11' },
    );

    service.updateModpackOverrides(rootPath, id, {
      'config/options.txt': Buffer.from('graphics=fancy', 'utf-8'),
    });

    const overridesFile = path.join(
      rootPath,
      'modpacks',
      id,
      'overrides',
      'config',
      'options.txt',
    );
    const manifestPath = path.join(rootPath, 'modpacks', id, 'manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as ModpackManifest;

    expect(fs.readFileSync(overridesFile, 'utf-8')).toBe('graphics=fancy');
    expect(manifest.overrides).toBe('overrides');
  });

  it('creates a local modpack from a manifest and preserves runtime metadata', async () => {
    const rootPath = createTempDir();
    tempDirs.push(rootPath);

    const service = new ModpackService();
    const manifest: ModpackManifest = {
      formatVersion: 1,
      minecraft: {
        version: '1.20.1',
        modLoaders: [{ id: 'fabric-0.15.11', primary: true }],
      },
      name: 'Imported Pack',
      version: '2.0.0',
      author: 'FMCL',
      files: [],
      overrides: 'overrides',
    };

    const result = await service.createFromManifest(
      rootPath,
      manifest,
      {} as ModPlatformService,
    );

    const config = service.loadModpackConfig(rootPath, result.id);
    const createdManifestPath = path.join(rootPath, 'modpacks', result.id, 'manifest.json');
    const createdManifest = JSON.parse(
      fs.readFileSync(createdManifestPath, 'utf-8'),
    ) as ModpackManifest;

    expect(config.name).toBe('Imported Pack');
    expect(config.runtime.minecraft).toBe('1.20.1');
    expect(config.runtime.modLoader).toEqual({ type: 'fabric', version: '0.15.11' });
    expect(createdManifest.name).toBe('Imported Pack');
    expect(createdManifest.version).toBe('2.0.0');
  });

  it('passes through content statistics and cleanup calls to the content manager', async () => {
    const expectedStats = {
      totalSize: 12,
      dedupedSize: 6,
      totalFiles: 3,
      storedFiles: 2,
    };
    const expectedCleanup = {
      freedSize: 16,
      deletedFiles: 1,
    };
    const manager = {
      getStats: vi.fn().mockResolvedValue(expectedStats),
      cleanup: vi.fn().mockResolvedValue(expectedCleanup),
    } as unknown as ContentManager;

    const service = new ModpackService(manager);

    await expect(service.getContentStats()).resolves.toEqual(expectedStats);
    await expect(service.cleanupContent()).resolves.toEqual(expectedCleanup);

    expect(manager.getStats).toHaveBeenCalledOnce();
    expect(manager.cleanup).toHaveBeenCalledOnce();
  });

  it('links an already cached Modrinth file instead of scheduling a download', async () => {
    const rootPath = createTempDir();
    const cacheRoot = createTempDir();
    tempDirs.push(rootPath, cacheRoot);

    const cachedHash = 'abc123';
    const cachedStoreFile = path.join(cacheRoot, cachedHash);
    fs.writeFileSync(cachedStoreFile, 'cached');

    const linkFile = vi.fn().mockResolvedValue(undefined);
    const importFile = vi.fn().mockResolvedValue(cachedHash);
    const contentManager = {
      getStorePath: vi.fn().mockReturnValue(cachedStoreFile),
      linkFile,
      importFile,
      getStats: vi.fn(),
      cleanup: vi.fn(),
    } as unknown as ContentManager;

    const service = new ModpackService(contentManager);
    const { id } = service.createLocalModpack(rootPath, 'Cached Pack', '1.0.0', '1.20.1');

    const platformService = {
      getModrinthClient: () => ({
        getProjectVersion: vi.fn().mockResolvedValue({
          files: [
            {
              primary: true,
              filename: 'cached-mod.jar',
              url: 'https://example.invalid/cached-mod.jar',
              hashes: { sha1: cachedHash },
            },
          ],
        }),
      }),
    } as unknown as ModPlatformService;

    const manifest: ModpackManifest = {
      formatVersion: 1,
      minecraft: {
        version: '1.20.1',
        modLoaders: [],
      },
      name: 'Cached Pack',
      version: '1.0.0',
      files: [
        {
          projectId: 'example-project',
          versionId: 'version-1',
          required: true,
        },
      ],
    };

    await service.installModsFromManifest(rootPath, id, manifest, platformService);

    expect(linkFile).toHaveBeenCalledOnce();
    const [linkedDestination, linkedHash] = linkFile.mock.calls[0] ?? [];
    expect(typeof linkedDestination).toBe('string');
    expect(linkedDestination).toContain(path.join('modpacks', id, 'mods', 'cached-mod.jar'));
    expect(linkedHash).toBe(cachedHash);
    expect(importFile).not.toHaveBeenCalled();
    expect(mocked.queueAdd).not.toHaveBeenCalled();
    expect(mocked.downloadSingle).not.toHaveBeenCalled();
  });

  it('downloads and stores a Modrinth file when the content cache misses', async () => {
    const rootPath = createTempDir();
    const tempPath = createTempDir();
    const storeRoot = createTempDir();
    tempDirs.push(rootPath, tempPath, storeRoot);

    mocked.appGetPath.mockImplementation((name) => {
      if (name === 'temp') {
        return tempPath;
      }

      if (name === 'userData') {
        return rootPath;
      }

      throw new Error(`Unexpected app path request: ${name}`);
    });

    const storeHash = 'sha1hash';
    const missingStoreFile = path.join(storeRoot, storeHash);
    const linkFile = vi.fn().mockResolvedValue(undefined);
    const importFile = vi.fn().mockResolvedValue(storeHash);
    const contentManager = {
      getStorePath: vi.fn().mockReturnValue(missingStoreFile),
      linkFile,
      importFile,
      getStats: vi.fn(),
      cleanup: vi.fn(),
    } as unknown as ContentManager;

    const service = new ModpackService(contentManager);
    const { id } = service.createLocalModpack(rootPath, 'Download Pack', '1.0.0', '1.20.1');

    const platformService = {
      getModrinthClient: () => ({
        getProjectVersion: vi.fn().mockResolvedValue({
          files: [
            {
              primary: true,
              filename: 'downloaded-mod.jar',
              url: 'https://example.invalid/downloaded-mod.jar',
              hashes: { sha1: storeHash },
            },
          ],
        }),
      }),
    } as unknown as ModPlatformService;

    const manifest: ModpackManifest = {
      formatVersion: 1,
      minecraft: {
        version: '1.20.1',
        modLoaders: [],
      },
      name: 'Download Pack',
      version: '1.0.0',
      files: [
        {
          projectId: 'example-project',
          versionId: 'version-2',
          required: true,
        },
      ],
    };

    await service.installModsFromManifest(rootPath, id, manifest, platformService);

    expect(mocked.queueAdd).toHaveBeenCalledOnce();
    expect(mocked.downloadSingle).toHaveBeenCalledOnce();
    expect(importFile).toHaveBeenCalledOnce();
    const [downloadDestination, downloadedHash] = linkFile.mock.calls[0] ?? [];
    expect(typeof downloadDestination).toBe('string');
    expect(downloadDestination).toContain(path.join('modpacks', id, 'mods', 'downloaded-mod.jar'));
    expect(downloadedHash).toBe(storeHash);
  });
});
