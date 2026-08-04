import { afterEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => ({
  handlers: new Map<string, (...args: unknown[]) => unknown>(),
  getDefaultRootPath: vi.fn(() => '/launcher-root'),
  getModpackDir: vi.fn((rootPath: string, instanceId: string) => `${rootPath}/modpacks/${instanceId}`),
  resolveApprovedInstancePath: vi.fn((instancePath: string) => instancePath),
  listScreenshots: vi.fn(),
  deleteScreenshot: vi.fn(),
  renameScreenshot: vi.fn(),
  openScreenshotFolder: vi.fn(),
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

vi.mock('../../../services/screenshots/screenshotService', () => ({
  screenshotService: {
    listScreenshots: mocked.listScreenshots,
    deleteScreenshot: mocked.deleteScreenshot,
    renameScreenshot: mocked.renameScreenshot,
    openScreenshotFolder: mocked.openScreenshotFolder,
  },
}));

import { registerScreenshotsHandlers } from '../screenshotsHandlers';

describe('screenshots IPC ID-only handlers', () => {
  afterEach(() => {
    mocked.handlers.clear();
    vi.clearAllMocks();
  });

  it('returns the screenshot list unchanged and propagates list errors', async () => {
    const screenshots = [{ name: 'first.png', path: '/launcher/first.png' }];
    mocked.listScreenshots.mockResolvedValueOnce(screenshots).mockRejectedValueOnce(new Error('list failed'));
    registerScreenshotsHandlers();

    const list = mocked.handlers.get('screenshots:list');

    await expect(list?.({}, 'alpha')).resolves.toBe(screenshots);
    await expect(list?.({}, 'alpha')).rejects.toThrow('list failed');
    expect(mocked.getModpackDir).toHaveBeenCalledWith('/launcher-root', 'alpha');
    expect(mocked.listScreenshots).toHaveBeenCalledWith('/launcher-root/modpacks/alpha');
  });

  it.each([
    ['screenshots:delete', 'deleteScreenshot', ['shot.png', 'alpha']],
    ['screenshots:rename', 'renameScreenshot', ['old.png', 'new.png', 'alpha']],
    ['screenshots:openFolder', 'openScreenshotFolder', ['alpha']],
  ] as const)('returns { ok: true } after %s succeeds', async (channel, serviceMethod, args) => {
    registerScreenshotsHandlers();

    const handler = mocked.handlers.get(channel);
    await expect(handler?.({}, ...args)).resolves.toEqual({ ok: true });
    expect(mocked[serviceMethod]).toHaveBeenCalled();
  });

  it('propagates mutation errors without converting them to a success result', async () => {
    mocked.deleteScreenshot.mockRejectedValueOnce(new Error('delete failed'));
    registerScreenshotsHandlers();

    const deleteScreenshot = mocked.handlers.get('screenshots:delete');

    await expect(deleteScreenshot?.({}, 'shot.png', 'alpha')).rejects.toThrow('delete failed');
  });

  it('rejects path-shaped instance IDs before the screenshots service receives them', async () => {
    registerScreenshotsHandlers();

    const list = mocked.handlers.get('screenshots:list');
    await expect(list?.({}, '../private')).rejects.toThrow(/instance id/i);

    expect(mocked.getModpackDir).not.toHaveBeenCalled();
    expect(mocked.listScreenshots).not.toHaveBeenCalled();
  });
});
