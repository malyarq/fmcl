import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => ({ userDataPath: '' }));

vi.mock('electron', () => ({
  app: { getPath: () => mocked.userDataPath },
}));

import { resolveApprovedLauncherRootPath } from '../paths';

describe('launcher root paths', () => {
  const cleanup: string[] = [];

  afterEach(() => {
    for (const target of cleanup.splice(0)) fs.rmSync(target, { recursive: true, force: true });
  });

  it('accepts the canonical filesystem path of the default launcher root', () => {
    const actualUserData = fs.mkdtempSync(path.join(os.tmpdir(), 'burrow-paths-actual-'));
    const aliasUserData = `${actualUserData}-alias`;
    cleanup.push(aliasUserData, actualUserData);
    fs.symlinkSync(actualUserData, aliasUserData, process.platform === 'win32' ? 'junction' : 'dir');
    mocked.userDataPath = aliasUserData;
    const defaultRoot = path.join(actualUserData, 'minecraft_data');
    fs.mkdirSync(defaultRoot);

    expect(resolveApprovedLauncherRootPath(fs.realpathSync.native(defaultRoot)))
      .toBe(fs.realpathSync.native(defaultRoot));
  });
});
