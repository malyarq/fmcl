import { beforeEach, describe, expect, it, vi } from 'vitest';

const electron = vi.hoisted(() => ({
  getPath: vi.fn(() => '/tmp/.fmcl'),
  setPath: vi.fn(),
  requestSingleInstanceLock: vi.fn(() => true),
}));

vi.mock('electron', () => ({ app: electron }));

import { acquireApplicationInstance, focusExistingWindow } from '../singleInstance';

describe('single application instance', () => {
  beforeEach(() => {
    electron.getPath.mockClear();
    electron.setPath.mockClear();
    electron.requestSingleInstanceLock.mockReset().mockReturnValue(true);
  });

  it('uses the production instance lock without creating a second profile', () => {
    electron.requestSingleInstanceLock.mockReturnValue(false);

    expect(acquireApplicationInstance()).toBe(false);
    expect(electron.requestSingleInstanceLock).toHaveBeenCalledTimes(1);
    expect(electron.setPath).not.toHaveBeenCalled();
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
