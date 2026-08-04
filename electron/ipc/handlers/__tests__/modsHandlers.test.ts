import { afterEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => ({
  handlers: new Map<string, (...args: unknown[]) => unknown>(),
  removeHandler: vi.fn(),
  installModFile: vi.fn(),
  searchMods: vi.fn(),
  getModVersions: vi.fn(),
}));

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, handler: (...args: unknown[]) => unknown) => mocked.handlers.set(channel, handler),
    removeHandler: mocked.removeHandler,
  },
}));

import { registerModsHandlers } from '../modsHandlers';

describe('mods IPC install security boundary', () => {
  const modPlatforms = {
    installModFile: mocked.installModFile,
    searchMods: mocked.searchMods,
    getModVersions: mocked.getModVersions,
  };

  afterEach(() => {
    mocked.handlers.clear();
    vi.clearAllMocks();
  });

  it('validates a path-free request, injects the approved root, and omits native paths from the response', async () => {
    mocked.installModFile.mockResolvedValueOnce({
      destination: '/private/root/instances/alpha/mods/sodium.jar',
      filename: 'sodium.jar',
      usedUrl: 'https://example.test/sodium.jar',
    });
    registerModsHandlers({ modPlatforms, getDefaultRootPath: () => '/approved/root' });

    const install = mocked.handlers.get('mods:installModFile');
    await expect(install?.({}, {
      instanceId: 'alpha',
      platform: 'modrinth',
      projectId: 'sodium',
      versionId: 'sodium-1.0.0',
      contentType: 'mod',
    })).resolves.toEqual({ status: 'success', filename: 'sodium.jar', issues: [] });

    expect(mocked.installModFile).toHaveBeenCalledWith({
      instanceId: 'alpha',
      platform: 'modrinth',
      projectId: 'sodium',
      versionId: 'sodium-1.0.0',
      contentType: 'mod',
    }, '/approved/root');
  });

  it.each([
    { instanceId: '../alpha', platform: 'modrinth', projectId: 'sodium', versionId: 'version', contentType: 'mod' },
    { instanceId: 'alpha', platform: 'modrinth', projectId: 'sodium', versionId: 'version', contentType: 'mod', rootPath: '/private/root' },
    { instanceId: 'alpha', platform: 'modrinth', projectId: 'sodium', versionId: 'version', contentType: 'datapack' },
  ])('rejects non-semantic install input %# before the service receives it', async (request) => {
    registerModsHandlers({ modPlatforms, getDefaultRootPath: () => '/approved/root' });

    await expect(mocked.handlers.get('mods:installModFile')?.({}, request)).rejects.toThrow();
    expect(mocked.installModFile).not.toHaveBeenCalled();
  });
});
