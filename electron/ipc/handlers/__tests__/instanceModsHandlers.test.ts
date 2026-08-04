import { afterEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => ({
  handlers: new Map<string, (...args: unknown[]) => unknown>(),
  removeHandler: vi.fn(),
  list: vi.fn(),
  remove: vi.fn(),
  setEnabled: vi.fn(),
  register: vi.fn(),
}));

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, handler: (...args: unknown[]) => unknown) => mocked.handlers.set(channel, handler),
    removeHandler: mocked.removeHandler,
  },
}));

import { registerInstanceModsHandlers } from '../instanceModsHandlers';

describe('instance-mods IPC security boundary', () => {
  const instanceMods = {
    list: mocked.list,
    remove: mocked.remove,
    setEnabled: mocked.setEnabled,
    register: mocked.register,
  };

  afterEach(() => {
    mocked.handlers.clear();
    vi.clearAllMocks();
  });

  it('uses only the opaque instance ID to list mods through the root-scoped service', async () => {
    const mods = [{ id: 'mod-a' }];
    mocked.list.mockResolvedValueOnce(mods);
    registerInstanceModsHandlers({ instanceMods });

    const list = mocked.handlers.get('instance-mods:list');
    await expect(list?.({}, 'alpha')).resolves.toBe(mods);

    expect(mocked.list).toHaveBeenCalledWith('alpha');
  });

  it.each([
    ['instance-mods:remove', ['alpha', 'example.jar']],
    ['instance-mods:setEnabled', ['alpha', 'example.jar', false]],
  ] as const)('returns { ok: true } after %s succeeds', async (channel, args) => {
    registerInstanceModsHandlers({ instanceMods });

    await expect(mocked.handlers.get(channel)?.({}, ...args)).resolves.toEqual({ ok: true });
  });

  it('rejects path-shaped IDs and file names before the service receives them', async () => {
    registerInstanceModsHandlers({ instanceMods });

    const list = mocked.handlers.get('instance-mods:list');
    const remove = mocked.handlers.get('instance-mods:remove');

    await expect(list?.({}, '../private')).rejects.toThrow(/instance id/i);
    await expect(remove?.({}, 'alpha', '../private.jar')).rejects.toThrow(/mod filename/i);

    expect(mocked.list).not.toHaveBeenCalled();
    expect(mocked.remove).not.toHaveBeenCalled();
  });

  it('rejects non-boolean enabled payloads before the service receives them', async () => {
    registerInstanceModsHandlers({ instanceMods });

    const setEnabled = mocked.handlers.get('instance-mods:setEnabled');
    await expect(setEnabled?.({}, 'alpha', 'example.jar', 'true')).rejects.toThrow(/mod enabled/i);

    expect(mocked.setEnabled).not.toHaveBeenCalled();
  });

  it('registers validated logical provider identifiers against the main-owned root', async () => {
    registerInstanceModsHandlers({ instanceMods });

    const register = mocked.handlers.get('instance-mods:register');
    await expect(register?.({}, 'alpha', {
      platform: 'modrinth',
      projectId: 'sodium',
      versionId: 'sodium-1.0.0',
    })).resolves.toEqual({ ok: true });

    expect(mocked.register).toHaveBeenCalledWith('alpha', {
      platform: 'modrinth',
      projectId: 'sodium',
      versionId: 'sodium-1.0.0',
    });
  });

  it('rejects path-shaped or overprivileged registration payloads before the service receives them', async () => {
    registerInstanceModsHandlers({ instanceMods });
    const register = mocked.handlers.get('instance-mods:register');

    await expect(register?.({}, 'alpha', {
      platform: 'modrinth',
      projectId: '../private',
      versionId: 'version',
    })).rejects.toThrow(/project id/i);
    await expect(register?.({}, 'alpha', {
      platform: 'modrinth',
      projectId: 'project',
      versionId: 'version',
      rootPath: '/private/root',
    })).rejects.toThrow(/unsupported fields/i);

    expect(mocked.register).not.toHaveBeenCalled();
  });
});
