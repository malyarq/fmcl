import { afterEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => ({
  handlers: new Map<string, (...args: unknown[]) => unknown>(),
  getDefaultRootPath: vi.fn(() => '/launcher-root'),
  getModpackDir: vi.fn((rootPath: string, instanceId: string) => `${rootPath}/modpacks/${instanceId}`),
  resolveApprovedInstancePath: vi.fn((instancePath: string) => instancePath),
  resolveWorldPath: vi.fn((instancePath: string, worldName: string) => `${instancePath}/saves/${worldName}`),
  list: vi.fn(),
  delete: vi.fn(),
  backup: vi.fn(),
  duplicate: vi.fn(),
}));

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, handler: (...args: unknown[]) => unknown) => mocked.handlers.set(channel, handler),
    removeHandler: vi.fn(),
  },
  shell: { openPath: vi.fn() },
}));

vi.mock('../../../services/instances/paths', () => ({
  getDefaultRootPath: mocked.getDefaultRootPath,
  getModpackDir: mocked.getModpackDir,
  resolveApprovedInstancePath: mocked.resolveApprovedInstancePath,
  resolveWorldPath: mocked.resolveWorldPath,
}));

vi.mock('../../../services/worlds/worldService', () => ({
  worldsService: {
    list: mocked.list,
    delete: mocked.delete,
    backup: mocked.backup,
    duplicate: mocked.duplicate,
  },
}));

import { registerWorldsHandlers } from '../worldsHandlers';

describe('worlds IPC ID-only handlers', () => {
  afterEach(() => {
    mocked.handlers.clear();
    vi.clearAllMocks();
  });

  it('resolves a validated instance ID under the main-owned launcher root before listing worlds', async () => {
    mocked.list.mockResolvedValue([]);
    registerWorldsHandlers();

    const list = mocked.handlers.get('worlds:listByInstanceId');
    await expect(list?.({}, 'alpha')).resolves.toEqual([]);

    expect(mocked.getModpackDir).toHaveBeenCalledWith('/launcher-root', 'alpha');
    expect(mocked.list).toHaveBeenCalledWith('/launcher-root/modpacks/alpha');
  });

  it('rejects path-shaped instance IDs and world names before the worlds service receives them', async () => {
    registerWorldsHandlers();

    const list = mocked.handlers.get('worlds:listByInstanceId');
    const deleteWorld = mocked.handlers.get('worlds:deleteByInstanceId');

    await expect(list?.({}, '../private')).rejects.toThrow(/instance id/i);
    await expect(deleteWorld?.({}, '../private', 'alpha')).rejects.toThrow(/world name/i);

    expect(mocked.getModpackDir).not.toHaveBeenCalled();
    expect(mocked.delete).not.toHaveBeenCalled();
  });

  it('does not expose the backup filesystem path through the ID-only method', async () => {
    mocked.backup.mockResolvedValue('/launcher-root/backups/alpha.zip');
    registerWorldsHandlers();

    const backup = mocked.handlers.get('worlds:backupByInstanceId');
    await expect(backup?.({}, 'world-one', 'alpha')).resolves.toBeUndefined();
  });

  it('registers no legacy path handlers', () => {
    registerWorldsHandlers();

    expect(mocked.handlers.get('worlds:list')).toBeUndefined();
    expect(mocked.handlers.get('worlds:delete')).toBeUndefined();
    expect(mocked.handlers.get('worlds:backup')).toBeUndefined();
    expect(mocked.handlers.get('worlds:duplicate')).toBeUndefined();
    expect(mocked.handlers.get('worlds:openFolder')).toBeUndefined();
  });
});
