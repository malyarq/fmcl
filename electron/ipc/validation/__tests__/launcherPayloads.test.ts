import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateLaunchGameOptions } from '../launcherPayloads';

describe('validateLaunchGameOptions', () => {
  const valid = {
    nickname: 'Steve',
    version: '1.21.1-Fabric',
    ram: 4,
    gamePath: path.join(os.tmpdir(), 'fmcl-root'),
    modpackId: 'my-pack',
    hideLauncher: true,
  };

  it('returns a bounded typed launch payload', () => {
    expect(validateLaunchGameOptions(valid)).toMatchObject(valid);
  });

  it('rejects traversal and arbitrary extra fields', () => {
    expect(() => validateLaunchGameOptions({ ...valid, modpackId: '../outside' })).toThrow('Modpack id');
    expect(() => validateLaunchGameOptions({ ...valid, shellCommand: 'open -a Calculator' })).toThrow('unsupported');
  });

  it('rejects unreasonable resource and command values', () => {
    expect(() => validateLaunchGameOptions({ ...valid, ram: 512 })).toThrow('64 or less');
    expect(() => validateLaunchGameOptions({ ...valid, version: '../../payload' })).toThrow('unsupported characters');
    expect(() => validateLaunchGameOptions({ ...valid, vmOptions: Array.from({ length: 65 }, () => '-Xmx1G') }))
      .toThrow('at most 64');
  });
});
