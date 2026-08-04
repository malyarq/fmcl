import { afterEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => ({
  handlers: new Map<string, (...args: unknown[]) => unknown>(),
  getDefaultRootPath: vi.fn(() => '/launcher-root'),
  getModpackDir: vi.fn((rootPath: string, instanceId: string) => `${rootPath}/modpacks/${instanceId}`),
  resolveApprovedInstancePath: vi.fn((instancePath: string) => instancePath),
  list: vi.fn(),
  enable: vi.fn(),
  disable: vi.fn(),
  delete: vi.fn(),
  install: vi.fn(),
  getModrinthClient: vi.fn(),
}));

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, handler: (...args: unknown[]) => unknown) => mocked.handlers.set(channel, handler),
  },
}));

vi.mock('../../../services/instances/paths', () => ({
  getDefaultRootPath: mocked.getDefaultRootPath,
  getModpackDir: mocked.getModpackDir,
  resolveApprovedInstancePath: mocked.resolveApprovedInstancePath,
}));

vi.mock('../../../services/instances/datapacksService', () => ({
  datapacksService: {
    list: mocked.list,
    enable: mocked.enable,
    disable: mocked.disable,
    delete: mocked.delete,
    install: mocked.install,
  },
}));

import { registerDatapacksHandlers } from '../datapacksHandlers';

describe('datapacks IPC ID-only handlers', () => {
  afterEach(() => {
    mocked.handlers.clear();
    vi.clearAllMocks();
  });

  it('resolves a validated instance ID and removes paths from datapack list results', async () => {
    mocked.list.mockResolvedValue([{
      fileName: 'pack.zip',
      name: 'Pack',
      description: 'A test pack',
      isEnabled: true,
      path: '/launcher-root/modpacks/alpha/saves/world-one/datapacks/pack.zip',
    }]);
    registerDatapacksHandlers({ modPlatforms: { getModrinthClient: mocked.getModrinthClient } } as never);

    const list = mocked.handlers.get('datapacks:listByInstanceId');
    await expect(list?.({}, 'alpha', 'world-one')).resolves.toEqual([{
      fileName: 'pack.zip',
      name: 'Pack',
      description: 'A test pack',
      isEnabled: true,
    }]);

    expect(mocked.getModpackDir).toHaveBeenCalledWith('/launcher-root', 'alpha');
    expect(mocked.list).toHaveBeenCalledWith('/launcher-root/modpacks/alpha', 'world-one');
  });

  it('rejects traversal before nested datapack actions reach the service', async () => {
    registerDatapacksHandlers({ modPlatforms: { getModrinthClient: mocked.getModrinthClient } } as never);

    const enable = mocked.handlers.get('datapacks:enableByInstanceId');

    await expect(enable?.({}, 'alpha', '../private', 'pack.zip')).rejects.toThrow(/world folder/i);
    await expect(enable?.({}, '../private', 'world-one', 'pack.zip')).rejects.toThrow(/instance id/i);
    await expect(enable?.({}, 'alpha', 'world-one', '../pack.zip')).rejects.toThrow(/datapack name/i);

    expect(mocked.getModpackDir).not.toHaveBeenCalled();
    expect(mocked.enable).not.toHaveBeenCalled();
  });

  it('runs nested datapack actions against the main-resolved instance path', async () => {
    registerDatapacksHandlers({ modPlatforms: { getModrinthClient: mocked.getModrinthClient } } as never);

    const enable = mocked.handlers.get('datapacks:enableByInstanceId');
    await expect(enable?.({}, 'alpha', 'world-one', 'pack.zip')).resolves.toEqual({ ok: true });

    expect(mocked.enable).toHaveBeenCalledWith('/launcher-root/modpacks/alpha', 'world-one', 'pack.zip');
  });

  it('registers no legacy path handlers', () => {
    registerDatapacksHandlers({ modPlatforms: { getModrinthClient: mocked.getModrinthClient } } as never);

    expect(mocked.handlers.get('datapacks:list')).toBeUndefined();
    expect(mocked.handlers.get('datapacks:enable')).toBeUndefined();
    expect(mocked.handlers.get('datapacks:disable')).toBeUndefined();
    expect(mocked.handlers.get('datapacks:delete')).toBeUndefined();
    expect(mocked.handlers.get('datapacks:install')).toBeUndefined();
  });
});
