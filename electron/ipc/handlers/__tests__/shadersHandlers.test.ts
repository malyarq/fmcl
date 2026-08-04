import { afterEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => ({
  handlers: new Map<string, (...args: unknown[]) => unknown>(),
  getDefaultRootPath: vi.fn(() => '/launcher-root'),
  getModpackDir: vi.fn((rootPath: string, instanceId: string) => `${rootPath}/modpacks/${instanceId}`),
  resolveApprovedInstancePath: vi.fn((instancePath: string) => instancePath),
  resolveShaderPacksDir: vi.fn((instancePath: string) => `${instancePath}/shaderpacks`),
  list: vi.fn(),
  setActiveShader: vi.fn(),
  disable: vi.fn(),
  delete: vi.fn(),
  import: vi.fn(),
}));

vi.mock('electron', () => ({
  dialog: { showOpenDialog: vi.fn() },
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
  resolveShaderPacksDir: mocked.resolveShaderPacksDir,
}));

vi.mock('../../../services/shaders/shaderService', () => ({
  shadersService: {
    list: mocked.list,
    setActiveShader: mocked.setActiveShader,
    disable: mocked.disable,
    delete: mocked.delete,
    import: mocked.import,
  },
}));

import { registerShadersHandlers } from '../shadersHandlers';

describe('shaders IPC handlers', () => {
  afterEach(() => {
    mocked.handlers.clear();
    vi.clearAllMocks();
  });

  it('resolves a validated instance ID under the main-owned launcher root before listing packs', async () => {
    mocked.list.mockResolvedValue([]);
    registerShadersHandlers();

    const list = mocked.handlers.get('shaders:list');
    await expect(list?.({}, 'alpha')).resolves.toEqual([]);

    expect(mocked.getModpackDir).toHaveBeenCalledWith('/launcher-root', 'alpha');
    expect(mocked.list).toHaveBeenCalledWith('/launcher-root/modpacks/alpha');
  });

  it('rejects path-shaped instance IDs and shader names before the shader service receives them', async () => {
    registerShadersHandlers();

    const list = mocked.handlers.get('shaders:list');
    const setActive = mocked.handlers.get('shaders:setActive');

    await expect(list?.({}, '../private')).rejects.toThrow(/instance id/i);
    await expect(setActive?.({}, '../private.zip', 'alpha')).rejects.toThrow(/shader pack name/i);

    expect(mocked.getModpackDir).not.toHaveBeenCalled();
    expect(mocked.setActiveShader).not.toHaveBeenCalled();
  });
});
