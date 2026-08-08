import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ModpackManifest } from '../../../../shared/types/modpack';
import type { ModPlatformService } from '../platform/modPlatformService';
import { StagingWorkspace } from '../../operations/stagingWorkspace';

const mocked = vi.hoisted(() => ({
  queueAdd: vi.fn<(run: () => Promise<void>) => Promise<void>>(),
  downloadSingle: vi.fn<(url: string | string[], destination: string, options?: unknown) => Promise<void>>(),
}));

vi.mock('../../download/downloadQueue', () => ({
  downloadQueue: { add: mocked.queueAdd },
}));

vi.mock('../../download/downloadManager', () => ({
  DownloadManager: { downloadSingle: mocked.downloadSingle },
}));

import { ManifestContentInstaller } from '../manifestContentInstaller';

function createDirectory(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function createStagedInstance(rootPath: string, instanceId = 'pack'): void {
  fs.mkdirSync(path.join(rootPath, 'modpacks', instanceId), { recursive: true });
}

function manifest(file: ModpackManifest['files'][number]): ModpackManifest {
  return {
    formatVersion: 1,
    minecraft: { version: '1.20.1', modLoaders: [] },
    name: 'Pack',
    version: '1.0.0',
    files: [file],
  };
}

describe('ManifestContentInstaller', () => {
  const directories: string[] = [];

  beforeEach(() => {
    mocked.queueAdd.mockReset();
    mocked.queueAdd.mockImplementation(async (run) => await run());
    mocked.downloadSingle.mockReset();
    mocked.downloadSingle.mockImplementation(async (_url, destination) => {
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.writeFileSync(destination, 'downloaded');
    });
  });

  afterEach(() => {
    for (const directory of directories.splice(0)) fs.rmSync(directory, { recursive: true, force: true });
  });

  it('links a cached provider file without downloading it', async () => {
    const rootPath = createDirectory('burrow-manifest-root-');
    const cachePath = createDirectory('burrow-manifest-cache-');
    const temporaryRoot = createDirectory('burrow-manifest-temp-');
    directories.push(rootPath, cachePath, temporaryRoot);
    createStagedInstance(rootPath);
    const cachedFile = path.join(cachePath, 'sha1');
    fs.writeFileSync(cachedFile, 'cached');
    const contentStore = {
      getStorePath: vi.fn(() => cachedFile),
      importFile: vi.fn(),
      linkFile: vi.fn(),
    };
    const providers = {
      getModrinthClient: () => ({
        getProjectVersion: vi.fn().mockResolvedValue({
          files: [{ primary: true, filename: 'cached.jar', url: 'https://example.invalid/cached.jar', hashes: { sha1: 'sha1' } }],
        }),
      }),
    } as unknown as ModPlatformService;

    await expect(new ManifestContentInstaller(contentStore, temporaryRoot).install(
      rootPath,
      'pack',
      manifest({ projectId: 'project', versionId: 'version', required: true }),
      providers,
    )).resolves.toEqual([]);

    expect(contentStore.linkFile).toHaveBeenCalledOnce();
    expect(contentStore.linkFile.mock.calls[0]?.[0]).toMatch(/\/modpacks\/pack\/mods\/cached\.jar$/);
    expect(contentStore.linkFile.mock.calls[0]?.[1]).toBe('sha1');
    expect(contentStore.importFile).not.toHaveBeenCalled();
    expect(mocked.downloadSingle).not.toHaveBeenCalled();
  });

  it('downloads a cache miss, imports it, links it and removes the temporary file', async () => {
    const rootPath = createDirectory('burrow-manifest-root-');
    const cachePath = createDirectory('burrow-manifest-cache-');
    const temporaryRoot = createDirectory('burrow-manifest-temp-');
    directories.push(rootPath, cachePath, temporaryRoot);
    createStagedInstance(rootPath);
    const contentStore = {
      getStorePath: vi.fn(() => path.join(cachePath, 'missing')),
      importFile: vi.fn().mockResolvedValue('sha1'),
      linkFile: vi.fn(),
    };
    const providers = {
      getModrinthClient: () => ({
        getProjectVersion: vi.fn().mockResolvedValue({
          files: [{ primary: true, filename: 'downloaded.jar', url: 'https://example.invalid/downloaded.jar', hashes: { sha1: 'sha1' } }],
        }),
      }),
    } as unknown as ModPlatformService;

    await new ManifestContentInstaller(contentStore, temporaryRoot).install(
      rootPath,
      'pack',
      manifest({ projectId: 'project', versionId: 'version', required: true }),
      providers,
    );

    expect(mocked.downloadSingle).toHaveBeenCalledOnce();
    const temporaryPath = mocked.downloadSingle.mock.calls[0]?.[1];
    expect(typeof temporaryPath).toBe('string');
    expect(contentStore.importFile).toHaveBeenCalledWith(temporaryPath, 'sha1', 'sha1');
    expect(contentStore.linkFile).toHaveBeenCalledOnce();
    expect(contentStore.linkFile.mock.calls[0]?.[0]).toMatch(/\/modpacks\/pack\/mods\/downloaded\.jar$/);
    expect(contentStore.linkFile.mock.calls[0]?.[1]).toBe('sha1');
    expect(fs.existsSync(temporaryPath as string)).toBe(false);
  });

  it('returns a typed failure and writes nothing for unresolved or path-shaped provider files', async () => {
    const rootPath = createDirectory('burrow-manifest-root-');
    const cachePath = createDirectory('burrow-manifest-cache-');
    const temporaryRoot = createDirectory('burrow-manifest-temp-');
    directories.push(rootPath, cachePath, temporaryRoot);
    createStagedInstance(rootPath);
    const contentStore = {
      getStorePath: vi.fn(() => path.join(cachePath, 'missing')),
      importFile: vi.fn(),
      linkFile: vi.fn(),
    };
    const providers = {
      getModrinthClient: () => ({
        getProjectVersion: vi.fn().mockResolvedValue({
          files: [{ primary: true, filename: '../escape.jar', url: 'https://example.invalid/escape.jar', hashes: { sha1: 'sha1' } }],
        }),
      }),
    } as unknown as ModPlatformService;

    await expect(new ManifestContentInstaller(contentStore, temporaryRoot).install(
      rootPath,
      'pack',
      manifest({ projectId: 'project', versionId: 'version', required: true }),
      providers,
    )).resolves.toEqual([{ index: 0, reason: 'content-install-failed' }]);

    expect(fs.existsSync(path.join(rootPath, 'modpacks', 'escape.jar'))).toBe(false);
    expect(contentStore.importFile).not.toHaveBeenCalled();
    expect(contentStore.linkFile).not.toHaveBeenCalled();
  });

  it('installs a CurseForge manifest entry through its numeric provider IDs', async () => {
    const rootPath = createDirectory('burrow-manifest-root-');
    const cachePath = createDirectory('burrow-manifest-cache-');
    const temporaryRoot = createDirectory('burrow-manifest-temp-');
    directories.push(rootPath, cachePath, temporaryRoot);
    createStagedInstance(rootPath);
    const contentStore = {
      getStorePath: vi.fn(() => path.join(cachePath, 'missing')),
      importFile: vi.fn(),
      linkFile: vi.fn(),
    };
    const providers = {
      getCurseForgeClient: () => ({
        getModFile: vi.fn().mockResolvedValue({
          fileName: 'curseforge.jar',
          downloadUrl: 'https://example.invalid/curseforge.jar',
          hashes: [],
        }),
      }),
    } as unknown as ModPlatformService;

    await expect(new ManifestContentInstaller(contentStore, temporaryRoot).install(
      rootPath,
      'pack',
      manifest({ projectID: 12, fileID: 34, required: true }),
      providers,
    )).resolves.toEqual([]);

    expect(mocked.downloadSingle).toHaveBeenCalledOnce();
    expect(mocked.downloadSingle.mock.calls[0]?.[1]).toMatch(/\/modpacks\/pack\/mods\/curseforge\.jar$/);
    expect(contentStore.importFile).not.toHaveBeenCalled();
  });

  it('accepts the exact StagingWorkspace root shape used by share imports', async () => {
    const launcherRoot = createDirectory('burrow-share-root-');
    const cachePath = createDirectory('burrow-manifest-cache-');
    const temporaryRoot = createDirectory('burrow-manifest-temp-');
    directories.push(launcherRoot, cachePath, temporaryRoot);
    const workspace = new StagingWorkspace(launcherRoot, 'share-operation');
    fs.mkdirSync(workspace.stagedModpack('share-pack'), { recursive: true });
    const cachedFile = path.join(cachePath, 'sha1');
    fs.writeFileSync(cachedFile, 'cached');
    const contentStore = {
      getStorePath: vi.fn(() => cachedFile),
      importFile: vi.fn(),
      linkFile: vi.fn(),
    };
    const providers = {
      getModrinthClient: () => ({
        getProjectVersion: vi.fn().mockResolvedValue({
          files: [{ primary: true, filename: 'shared.jar', url: 'https://example.invalid/shared.jar', hashes: { sha1: 'sha1' } }],
        }),
      }),
    } as unknown as ModPlatformService;

    await expect(new ManifestContentInstaller(contentStore, temporaryRoot).install(
      workspace.stagingRoot,
      'share-pack',
      manifest({ projectId: 'project', versionId: 'version', required: true }),
      providers,
    )).resolves.toEqual([]);

    expect(contentStore.linkFile.mock.calls[0]?.[0]).toMatch(
      /\/\.burrow-operations\/staging\/share-operation\/modpacks\/share-pack\/mods\/shared\.jar$/,
    );
  });
});
