import { EventEmitter } from 'node:events';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const autoUpdater = Object.assign(new EventEmitter(), {
  autoDownload: true,
  autoInstallOnAppQuit: false,
  downloadUpdate: vi.fn(),
});

describe('SelfUpdater download policy', () => {
  beforeEach(() => {
    vi.resetModules();
    autoUpdater.removeAllListeners();
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = false;
    autoUpdater.downloadUpdate.mockReset();
    vi.doMock('electron-updater', () => ({
      default: { autoUpdater },
    }));
  });

  it('announces an available update without downloading before user consent', async () => {
    const send = vi.fn();
    const win = {
      on: vi.fn(),
      isDestroyed: () => false,
      webContents: { send },
    };
    const { SelfUpdater } = await import('../appUpdater');

    new SelfUpdater(win as never);
    autoUpdater.emit('update-available', { version: '0.7.0' });

    expect(autoUpdater.autoDownload).toBe(false);
    expect(autoUpdater.autoInstallOnAppQuit).toBe(true);
    expect(autoUpdater.downloadUpdate).not.toHaveBeenCalled();
    expect(send).toHaveBeenCalledWith('app-updater:available', { version: '0.7.0' });
  });
});
