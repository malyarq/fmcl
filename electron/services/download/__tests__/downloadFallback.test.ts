import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import AdmZip from 'adm-zip';
import type { Dispatcher } from 'undici';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mirror } from '@shared/types';

const mocked = vi.hoisted(() => ({
  download: vi.fn(),
  fetch: vi.fn(),
  getVersionList: vi.fn(),
}));

vi.mock('@xmcl/file-transfer', () => ({
  DefaultRangePolicy: class DefaultRangePolicy {
    constructor(_threshold: number, _concurrency: number) {}
  },
  download: (...args: unknown[]) => mocked.download(...args),
}));

vi.mock('@xmcl/installer', () => ({
  getVersionList: (...args: unknown[]) => mocked.getVersionList(...args),
}));

import { DefaultRangePolicy } from '@xmcl/file-transfer';
import { DownloadManager } from '../downloadManager';
import { RuntimeDownloadService } from '../../runtime/downloadService';

function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'fmcl-download-fallback-'));
}

function createJarBuffer(): Buffer {
  const zip = new AdmZip();
  zip.addFile('mods/example.txt', Buffer.from('ok', 'utf8'));
  return zip.toBuffer();
}

describe('RuntimeDownloadService mirror ordering', () => {
  beforeEach(() => {
    mocked.getVersionList.mockReset();
  });

  it('builds candidate lists in persisted mirror priority order while honoring bad-host filtering', () => {
    const mirrors: Mirror[] = [
      {
        id: 'custom-primary',
        name: 'Custom',
        type: 'custom',
        rootUrl: 'https://mirror.example.com',
        priority: 1,
        isActive: true,
      },
      {
        id: 'official',
        name: 'Official',
        type: 'official',
        rootUrl: 'https://launchermeta.mojang.com',
        priority: 2,
        isActive: false,
      },
      {
        id: 'bmcl',
        name: 'BMCLAPI',
        type: 'bmcl',
        rootUrl: 'https://bmclapi2.bangbang93.com',
        priority: 3,
        isActive: false,
      },
    ];

    const mirrorsService = {
      getPreferredMirrors: () => mirrors,
    };
    const service = new RuntimeDownloadService(mirrorsService as never);
    const provider = service.getDownloadProvider();
    const options = service.buildInstallerOptions(
      provider,
      {} as Dispatcher,
      new DefaultRangePolicy(0, 0),
      8,
    );

    const initialCandidates = options.libraryHost({
      download: {
        url: 'https://libraries.minecraft.net/com/example/mod.jar',
      },
    } as never);

    expect(initialCandidates).toEqual([
      'https://mirror.example.com/libraries/com/example/mod.jar',
      'https://libraries.minecraft.net/com/example/mod.jar',
      'https://bmclapi2.bangbang93.com/libraries/com/example/mod.jar',
    ]);

    service.blacklistOrigins(['https://mirror.example.com'], () => undefined);
    const filteredCandidates = options.libraryHost({
      download: {
        url: 'https://libraries.minecraft.net/com/example/mod.jar',
      },
    } as never);

    expect(filteredCandidates).toEqual([
      'https://libraries.minecraft.net/com/example/mod.jar',
      'https://bmclapi2.bangbang93.com/libraries/com/example/mod.jar',
    ]);
  });

  it('tries persisted mirror candidates in order when fetching the version manifest', async () => {
    const mirrors: Mirror[] = [
      {
        id: 'custom-primary',
        name: 'Custom',
        type: 'custom',
        rootUrl: 'https://mirror.example.com',
        priority: 1,
        isActive: true,
      },
      {
        id: 'official',
        name: 'Official',
        type: 'official',
        rootUrl: 'https://launchermeta.mojang.com',
        priority: 2,
        isActive: false,
      },
    ];
    const service = new RuntimeDownloadService({
      getPreferredMirrors: () => mirrors,
    } as never);
    const provider = service.getDownloadProvider();
    const candidates = provider.getVersionListURLs();
    const expectedManifest = {
      latest: { release: '1.21.5', snapshot: '24w14a' },
      versions: [],
    };

    mocked.getVersionList
      .mockRejectedValueOnce(new Error('mirror unavailable'))
      .mockResolvedValueOnce(expectedManifest);

    await expect(service.getVersionList(provider)).resolves.toEqual(expectedManifest);

    expect(mocked.getVersionList).toHaveBeenCalledTimes(2);
    expect(mocked.getVersionList.mock.calls[0]?.[0]).toMatchObject({ remote: candidates[0] });
    expect(mocked.getVersionList.mock.calls[1]?.[0]).toMatchObject({ remote: candidates[1] });
  });
});

describe('DownloadManager fallback handling', () => {
  const tempDirs: string[] = [];

  beforeEach(() => {
    mocked.download.mockReset();
    mocked.fetch.mockReset();
    mocked.fetch.mockResolvedValue({ ok: false });
    vi.stubGlobal('fetch', mocked.fetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();

    for (const dir of tempDirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('falls back to the next candidate when the primary mirror download fails', async () => {
    const root = createTempDir();
    tempDirs.push(root);
    const destination = path.join(root, 'mods', 'fallback.jar');

    mocked.download.mockImplementation(async (params: { url: string; destination: string }) => {
      if (params.url.includes('primary.example.com')) {
        throw new Error('HTTP 503');
      }

      fs.mkdirSync(path.dirname(params.destination), { recursive: true });
      fs.writeFileSync(params.destination, createJarBuffer());
    });

    await expect(
      DownloadManager.downloadSingle(
        ['https://primary.example.com/fallback.jar', 'https://backup.example.com/fallback.jar'],
        destination,
      ),
    ).resolves.toBeUndefined();

    expect(mocked.download).toHaveBeenCalledTimes(2);
    expect(fs.existsSync(destination)).toBe(true);
  });

  it('rejects a corrupted primary result and succeeds only after a healthy fallback', async () => {
    const root = createTempDir();
    tempDirs.push(root);
    const destination = path.join(root, 'mods', 'corrupted.jar');

    mocked.download.mockImplementation(async (params: { url: string; destination: string }) => {
      fs.mkdirSync(path.dirname(params.destination), { recursive: true });
      if (params.url.includes('corrupt.example.com')) {
        fs.writeFileSync(params.destination, Buffer.from('not-a-zip', 'utf8'));
        return;
      }

      fs.writeFileSync(params.destination, createJarBuffer());
    });

    await expect(
      DownloadManager.downloadSingle(
        ['https://corrupt.example.com/corrupted.jar', 'https://healthy.example.com/corrupted.jar'],
        destination,
      ),
    ).resolves.toBeUndefined();

    expect(mocked.download).toHaveBeenCalledTimes(2);
    expect(fs.readFileSync(destination).subarray(0, 2).toString('utf8')).toBe('PK');
  });
});
