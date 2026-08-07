import { beforeEach, describe, expect, it, vi } from 'vitest';

const electron = vi.hoisted(() => ({
  getPath: vi.fn(() => '/tmp/.fmcl'),
  setPath: vi.fn(),
  getVersion: vi.fn(() => '0.9.1'),
  requestSingleInstanceLock: vi.fn(() => true),
}));

vi.mock('electron', () => ({ app: electron }));

import { acquireApplicationInstance, focusExistingWindow, getCurrentExecutablePath, handleSecondApplicationInstance, isNewerApplicationVersion, resolveIncomingUpgrade } from '../singleInstance';

describe('single application instance', () => {
  beforeEach(() => {
    electron.getPath.mockClear();
    electron.setPath.mockClear();
    electron.requestSingleInstanceLock.mockReset().mockReturnValue(true);
  });

  it('uses the production instance lock without creating a second profile', () => {
    electron.requestSingleInstanceLock.mockReturnValue(false);

    expect(acquireApplicationInstance()).toBe(false);
    expect(electron.requestSingleInstanceLock).toHaveBeenCalledWith(expect.objectContaining({ version: '0.9.1' }));
    expect(electron.setPath).not.toHaveBeenCalled();
  });

  it('accepts only a newer launcher executable for installed upgrade handoff', () => {
    expect(isNewerApplicationVersion('0.9.1', '0.10.0')).toBe(true);
    expect(isNewerApplicationVersion('0.9.1', '0.9.0')).toBe(false);
    expect(isNewerApplicationVersion('1.0.0-rc.1', '1.0.0')).toBe(true);
    expect(resolveIncomingUpgrade('0.9.1', { version: '0.9.2', executablePath: '/Applications/FriendLauncher.app/Contents/MacOS/FriendLauncher' }))
      .toEqual({ version: '0.9.2', executablePath: '/Applications/FriendLauncher.app/Contents/MacOS/FriendLauncher' });
    expect(resolveIncomingUpgrade('0.9.1', { version: '0.9.2', executablePath: '/tmp/not-the-launcher' })).toBeUndefined();
    expect(resolveIncomingUpgrade('0.9.1', { version: '0.9.1', executablePath: '/tmp/FriendLauncher.AppImage' })).toBeUndefined();
  });

  it('uses the stable AppImage path for Linux relaunch handoff', () => {
    expect(getCurrentExecutablePath({ APPIMAGE: '/opt/FriendLauncher-Linux-0.9.2.AppImage' }, '/tmp/.mount/AppRun'))
      .toBe('/opt/FriendLauncher-Linux-0.9.2.AppImage');
  });

  it('gracefully relaunches a newer installed package instead of focusing stale code', () => {
    const relaunch = vi.fn();
    const quit = vi.fn();
    const result = handleSecondApplicationInstance({
      currentVersion: '0.9.1',
      additionalData: { version: '0.9.2', executablePath: '/opt/FriendLauncher-Linux-0.9.2.AppImage' },
      window: null,
      relaunch,
      quit,
    });
    expect(result).toBe('upgrade');
    expect(relaunch).toHaveBeenCalledWith({ execPath: '/opt/FriendLauncher-Linux-0.9.2.AppImage' });
    expect(quit).toHaveBeenCalledOnce();
  });

  it('keeps the explicit second development slot isolated', () => {
    expect(acquireApplicationInstance('http://127.0.0.1:5174')).toBe(true);
    expect(electron.setPath).toHaveBeenCalledWith('userData', '/tmp/.fmcl_2');
    expect(electron.requestSingleInstanceLock).not.toHaveBeenCalled();
  });

  it('restores and focuses the existing production window', () => {
    const window = {
      isDestroyed: vi.fn(() => false),
      isMinimized: vi.fn(() => true),
      restore: vi.fn(),
      show: vi.fn(),
      focus: vi.fn(),
    };

    focusExistingWindow(window as never);

    expect(window.restore).toHaveBeenCalledTimes(1);
    expect(window.show).toHaveBeenCalledTimes(1);
    expect(window.focus).toHaveBeenCalledTimes(1);
  });
});
