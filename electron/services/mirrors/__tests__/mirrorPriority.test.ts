import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => ({
  appGetPath: vi.fn<(name: string) => string>(),
  netFetch: vi.fn(),
}));

vi.mock('electron', () => ({
  app: {
    getPath: mocked.appGetPath,
  },
  net: {
    fetch: mocked.netFetch,
  },
}));

import { MirrorsService } from '../mirrorsService';
import { AtomicJsonStore } from '../../storage/atomicJsonStore';

function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'fmcl-mirrors-service-'));
}

describe('MirrorsService priority ordering', () => {
  const tempDirs: string[] = [];

  beforeEach(() => {
    mocked.appGetPath.mockReset();
    mocked.netFetch.mockReset();
    mocked.netFetch.mockResolvedValue({ ok: true });
    mocked.appGetPath.mockImplementation(() => {
      const dir = createTempDir();
      tempDirs.push(dir);
      return dir;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();

    for (const dir of tempDirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('migrates a legacy selected mirror into priority order', () => {
    const userDataPath = createTempDir();
    tempDirs.push(userDataPath);
    mocked.appGetPath.mockImplementation(() => userDataPath);

    const mirrorsFile = path.join(userDataPath, 'mirrors.json');
    fs.writeFileSync(
      mirrorsFile,
      JSON.stringify(
        {
          mirrors: [
            {
              id: 'official',
              name: 'Official (Mojang)',
              type: 'official',
              rootUrl: 'https://launchermeta.mojang.com',
              priority: 1,
              isActive: false,
            },
            {
              id: 'bmcl',
              name: 'BMCLAPI',
              type: 'bmcl',
              rootUrl: 'https://bmclapi2.bangbang93.com',
              priority: 2,
              isActive: true,
            },
          ],
          selectedMirrorId: 'bmcl',
          autoSelect: false,
        },
        null,
        2,
      ),
    );

    const service = new MirrorsService();
    const mirrors = service.getMirrors();

    expect(mirrors.map((mirror) => mirror.id)).toEqual(['bmcl', 'official']);
    expect(mirrors.map((mirror) => mirror.priority)).toEqual([1, 2]);
    expect(service.getSelectedMirror()?.id).toBe('bmcl');
  });

  it('reorders mirrors and keeps the active primary at the front', async () => {
    const service = new MirrorsService();
    const custom = await service.addCustomMirror('Loopback Mirror', 'http://127.0.0.1:8080');

    await service.moveMirror(custom.id, 'up');
    expect(service.getMirrors().map((mirror) => mirror.id)).toEqual(['official', custom.id, 'bmcl']);

    await service.selectMirror(custom.id);
    const mirrors = service.getMirrors();

    expect(mirrors.map((mirror) => mirror.id)).toEqual([custom.id, 'official', 'bmcl']);
    expect(mirrors.map((mirror) => mirror.priority)).toEqual([1, 2, 3]);
    expect(service.getSelectedMirror()?.id).toBe(custom.id);
  });

  it('disables insecure saved custom mirrors and promotes the next enabled mirror', () => {
    const userDataPath = createTempDir();
    tempDirs.push(userDataPath);
    mocked.appGetPath.mockImplementation(() => userDataPath);

    const mirrorsFile = path.join(userDataPath, 'mirrors.json');
    fs.writeFileSync(
      mirrorsFile,
      JSON.stringify(
        {
          mirrors: [
            {
              id: 'custom-http',
              name: 'Insecure Mirror',
              type: 'custom',
              rootUrl: 'http://mirror.example.com',
              priority: 1,
              isActive: true,
            },
          ],
          selectedMirrorId: 'custom-http',
          autoSelect: false,
        },
        null,
        2,
      ),
    );

    const service = new MirrorsService();
    const mirrors = service.getMirrors();
    const insecure = mirrors.find((mirror) => mirror.id === 'custom-http');

    expect(insecure?.isDisabled).toBe(true);
    expect(insecure?.disabledReason).toBe('insecureRemoteHttp');
    expect(service.getSelectedMirror()?.id).toBe('official');
  });

  it('does not silently replace malformed mirror configuration with defaults', () => {
    const userDataPath = createTempDir();
    tempDirs.push(userDataPath);
    mocked.appGetPath.mockImplementation(() => userDataPath);
    const mirrorsFile = path.join(userDataPath, 'mirrors.json');
    fs.writeFileSync(mirrorsFile, '{broken mirrors');
    const original = fs.readFileSync(mirrorsFile);

    expect(() => new MirrorsService()).toThrow(/recovery backup are unavailable/);
    expect(fs.readFileSync(mirrorsFile)).toEqual(original);
  });

  it('does not publish in-memory mirror changes when persistence fails', async () => {
    const service = new MirrorsService();
    const before = service.getMirrors();
    vi.spyOn(AtomicJsonStore.prototype, 'write').mockImplementationOnce(() => {
      throw new Error('disk full');
    });

    await expect(service.addCustomMirror('Loopback Mirror', 'http://127.0.0.1:8080'))
      .rejects.toThrow('disk full');
    expect(service.getMirrors()).toEqual(before);
  });
});
