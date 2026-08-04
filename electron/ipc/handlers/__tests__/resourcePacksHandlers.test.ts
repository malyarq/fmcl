import { afterEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => ({
  handlers: new Map<string, (...args: unknown[]) => unknown>(),
  getDefaultRootPath: vi.fn(() => '/launcher-root'),
  getModpackDir: vi.fn((rootPath: string, instanceId: string) => `${rootPath}/modpacks/${instanceId}`),
  resolveApprovedInstancePath: vi.fn((instancePath: string) => instancePath),
  resolveResourcePacksDir: vi.fn((instancePath: string) => `${instancePath}/resourcepacks`),
  list: vi.fn(),
  enable: vi.fn(),
  disable: vi.fn(),
  reorder: vi.fn(),
  import: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('electron', () => ({
  dialog: { showOpenDialog: vi.fn() },
  ipcMain: {
    handle: (channel: string, handler: (...args: unknown[]) => unknown) => mocked.handlers.set(channel, handler),
  },
  shell: { openPath: vi.fn() },
}));

vi.mock('../../../services/instances/paths', () => ({
  getDefaultRootPath: mocked.getDefaultRootPath,
  getModpackDir: mocked.getModpackDir,
  resolveApprovedInstancePath: mocked.resolveApprovedInstancePath,
  resolveResourcePacksDir: mocked.resolveResourcePacksDir,
}));

vi.mock('../../../services/resourcePacks/resourcePackService', () => ({
  resourcePacksService: {
    list: mocked.list,
    enable: mocked.enable,
    disable: mocked.disable,
    reorder: mocked.reorder,
    import: mocked.import,
    delete: mocked.delete,
  },
}));

import { registerResourcePacksHandlers } from '../resourcePacksHandlers';

describe('resource packs IPC handlers', () => {
  afterEach(() => {
    mocked.handlers.clear();
    vi.clearAllMocks();
  });

  it('resolves a validated instance ID under the main-owned launcher root before listing packs', async () => {
    mocked.list.mockResolvedValue([]);
    registerResourcePacksHandlers();

    const list = mocked.handlers.get('resourcePacks:list');
    await expect(list?.({}, 'alpha')).resolves.toEqual([]);

    expect(mocked.getModpackDir).toHaveBeenCalledWith('/launcher-root', 'alpha');
    expect(mocked.list).toHaveBeenCalledWith('/launcher-root/modpacks/alpha');
  });

  it('rejects path-shaped instance IDs and child names before the resource-pack service receives them', async () => {
    registerResourcePacksHandlers();

    const list = mocked.handlers.get('resourcePacks:list');
    const enable = mocked.handlers.get('resourcePacks:enable');

    await expect(list?.({}, '../private')).rejects.toThrow(/instance id/i);
    await expect(enable?.({}, 'alpha', '../private.zip')).rejects.toThrow(/resource pack name/i);

    expect(mocked.getModpackDir).not.toHaveBeenCalled();
    expect(mocked.enable).not.toHaveBeenCalled();
  });
});
