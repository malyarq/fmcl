import { describe, expect, it } from 'vitest';
import { hasDeveloperIdIdentity, resolveBuilderArgs } from '../build-electron.js';

describe('Electron build signing selection', () => {
  it('uses ad-hoc signing only for a local macOS build without Developer ID', () => {
    const result = resolveBuilderArgs({ args: ['--publish', 'never'], platform: 'darwin', env: {}, developerIdAvailable: false });

    expect(result.signing).toBe('ad-hoc');
    expect(result.args).toEqual(expect.arrayContaining([
      '-c.mac.identity=-',
      '-c.mac.entitlements=resources/entitlements.adhoc.mac.plist',
      '-c.mac.entitlementsInherit=resources/entitlements.adhoc.mac.plist',
    ]));
  });

  it('preserves configured, explicit, and non-macOS signing paths', () => {
    expect(resolveBuilderArgs({ args: [], platform: 'darwin', env: { CSC_LINK: 'configured' }, developerIdAvailable: false }).signing).toBe('configured');
    expect(resolveBuilderArgs({ args: ['-c.mac.identity=Developer ID Application: Example'], platform: 'darwin', env: {}, developerIdAvailable: false }).signing).toBe('configured');
    expect(resolveBuilderArgs({ args: [], platform: 'linux', env: {}, developerIdAvailable: false }).signing).toBe('configured');
  });

  it('recognizes only a Developer ID Application identity', () => {
    const run = (_command: string, _args: string[]) => ({ status: 0, stdout: '  1) ABC "Developer ID Application: Example (ABCDE12345)"' });
    const unrelated = (_command: string, _args: string[]) => ({ status: 0, stdout: '  1) ABC "Apple Development: Example"' });

    expect(hasDeveloperIdIdentity(run as never)).toBe(true);
    expect(hasDeveloperIdIdentity(unrelated as never)).toBe(false);
  });
});
