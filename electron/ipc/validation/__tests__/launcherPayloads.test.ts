import { describe, expect, it } from 'vitest';
import { validateLaunchGameOptions } from '../launcherPayloads';

describe('validateLaunchGameOptions', () => {
  const valid = {
    nickname: 'Steve',
    version: '1.21.1-Fabric',
    ram: 4,
    instanceId: 'my-pack',
    hideLauncher: true,
  };

  it('returns a bounded typed launch payload', () => {
    expect(validateLaunchGameOptions(valid)).toMatchObject(valid);
  });

  it('rejects traversal and arbitrary extra fields', () => {
    expect(() => validateLaunchGameOptions({ ...valid, instanceId: '../outside' })).toThrow('Instance id');
    expect(() => validateLaunchGameOptions({ ...valid, shellCommand: 'open -a Calculator' })).toThrow('unsupported');
    for (const forbidden of ['gamePath', 'modpackPath', 'javaPath', 'instancePath', 'modpackId', 'vmOptions']) {
      expect(() => validateLaunchGameOptions({ ...valid, [forbidden]: '/private/value' })).toThrow('unsupported');
    }
  });

  it('rejects unreasonable resource and command values', () => {
    expect(() => validateLaunchGameOptions({ ...valid, ram: 512 })).toThrow('64 or less');
    expect(() => validateLaunchGameOptions({ ...valid, version: '../../payload' })).toThrow('unsupported characters');
  });
});
