import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const mocked = vi.hoisted(() => ({
  handlers: new Map<string, (...args: unknown[]) => unknown>(),
  showSaveDialog: vi.fn(),
  showOpenDialog: vi.fn(),
}));

vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => '/tmp') },
  dialog: { showSaveDialog: mocked.showSaveDialog, showOpenDialog: mocked.showOpenDialog },
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
  const temporaryDirectories: string[] = [];

  afterEach(() => {
    mocked.handlers.clear();
    clearSavePathAuthorizationsForTests();
    vi.restoreAllMocks();
    for (const directory of temporaryDirectories.splice(0)) fs.rmSync(directory, { recursive: true, force: true });
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

  it('exports only allowlisted settings in a versioned backup', async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'fmcl-settings-backup-'));
    temporaryDirectories.push(directory);
    const filePath = path.join(directory, 'settings.json');
    mocked.showSaveDialog.mockResolvedValue({ canceled: false, filePath });
    registerSettingsHandlers({ window: {} as never });
    const exportBackup = mocked.handlers.get('settings:exportBackup');

    await expect(exportBackup?.({}, { settings_language: 'ru', nickname: 'Alex' })).resolves.toEqual({
      canceled: false,
      fileName: 'settings.json',
    });
    expect(JSON.parse(fs.readFileSync(filePath, 'utf8'))).toMatchObject({
      schemaVersion: 1,
      product: 'FriendLauncher',
      values: { settings_language: 'ru', nickname: 'Alex' },
    });
    await expect(exportBackup?.({}, { mp_join_code: 'secret' })).rejects.toThrow(/unsupported key/i);
  });

  it('imports a valid backup and rejects unsupported keys', async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'fmcl-settings-backup-'));
    temporaryDirectories.push(directory);
    const filePath = path.join(directory, 'settings.json');
    fs.writeFileSync(filePath, JSON.stringify({
      schemaVersion: 1,
      product: 'FriendLauncher',
      createdAt: '2026-08-06T00:00:00.000Z',
      values: { settings_language: 'en' },
    }));
    mocked.showOpenDialog.mockResolvedValue({ canceled: false, filePaths: [filePath] });
    registerSettingsHandlers({ window: {} as never });
    const importBackup = mocked.handlers.get('settings:importBackup');

    await expect(importBackup?.({})).resolves.toEqual({
      canceled: false,
      fileName: 'settings.json',
      values: { settings_language: 'en' },
    });

    fs.writeFileSync(filePath, JSON.stringify({
      schemaVersion: 1,
      product: 'FriendLauncher',
      createdAt: '2026-08-06T00:00:00.000Z',
      values: { fmcl_analytics_install_id: 'secret' },
    }));
    await expect(importBackup?.({})).rejects.toThrow(/unsupported key/i);

    fs.writeFileSync(filePath, '{"accountToken":"must-not-appear-in-ui"');
    await expect(importBackup?.({})).rejects.toThrow('Settings backup is not valid JSON');

    fs.writeFileSync(filePath, JSON.stringify({
      schemaVersion: 1,
      product: 'FriendLauncher',
      createdAt: 'not-a-date',
      values: { settings_language: 'en' },
    }));
    await expect(importBackup?.({})).rejects.toThrow('Unsupported FMCL settings backup');

    fs.writeFileSync(filePath, JSON.stringify({
      schemaVersion: 1,
      product: 'FriendLauncher',
      createdAt: '2026-08-06',
      values: {},
    }));
    await expect(importBackup?.({})).rejects.toThrow('Unsupported FMCL settings backup');

    fs.writeFileSync(filePath, JSON.stringify({
      schemaVersion: 1,
      product: 'FriendLauncher',
      createdAt: '2026-08-06T00:00:00.000Z',
      values: {},
      unexpected: true,
    }));
    await expect(importBackup?.({})).rejects.toThrow('Unsupported FMCL settings backup');
  });
});
