import { afterEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => ({
  handlers: new Map<string, (...args: unknown[]) => unknown>(),
  showSaveDialog: vi.fn(),
}));

vi.mock('electron', () => ({
  app: { getPath: vi.fn() },
  dialog: { showSaveDialog: mocked.showSaveDialog },
  ipcMain: {
    removeHandler: (channel: string) => mocked.handlers.delete(channel),
    handle: (channel: string, handler: (...args: unknown[]) => unknown) => mocked.handlers.set(channel, handler),
  },
  shell: { openPath: vi.fn() },
}));

import { registerSettingsHandlers } from '../settingsHandlers';
import {
  clearSavePathAuthorizationsForTests,
  consumeAuthorizedSavePath,
} from '../../../security/savePathAuthorizations';

describe('settings native save dialog authorization', () => {
  afterEach(() => {
    mocked.handlers.clear();
    clearSavePathAuthorizationsForTests();
    vi.restoreAllMocks();
  });

  it('returns and authorizes the exact native path for the originating renderer', async () => {
    mocked.showSaveDialog.mockResolvedValue({ canceled: false, filePath: '/tmp/fmcl-authorized-export.zip' });
    registerSettingsHandlers({ window: {} as never });
    const showSaveDialog = mocked.handlers.get('dialog:showSaveDialog');

    await expect(showSaveDialog?.({ sender: { id: 7 } }, {})).resolves.toEqual({ canceled: false, filePath: '/tmp/fmcl-authorized-export.zip' });
    expect(consumeAuthorizedSavePath(7, '/tmp/fmcl-authorized-export.zip')).toBe('/tmp/fmcl-authorized-export.zip');
  });

  it('does not create an authorization when the native save dialog is cancelled', async () => {
    mocked.showSaveDialog.mockResolvedValue({ canceled: true, filePath: undefined });
    registerSettingsHandlers({ window: {} as never });
    const showSaveDialog = mocked.handlers.get('dialog:showSaveDialog');

    await expect(showSaveDialog?.({ sender: { id: 7 } }, {})).resolves.toEqual({ canceled: true, filePath: undefined });
    expect(() => consumeAuthorizedSavePath(7, '/tmp/fmcl-cancelled-export.zip')).toThrow('not authorized');
  });
});
