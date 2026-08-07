import { describe, expect, it, vi } from 'vitest';
import { checkSystemReadiness } from '../systemReadiness';

describe('system readiness', () => {
  it('reports a ready environment without exposing native paths', async () => {
    const report = await checkSystemReadiness({
      rootPath: '/private/game',
      scanJava: async () => [{ path: '/private/java', version: '21', majorVersion: 21, valid: true }],
      verifyStorage: vi.fn().mockResolvedValue(undefined),
      getFreeBytes: vi.fn().mockResolvedValue(20 * 1024 ** 3),
      verifyNetwork: vi.fn().mockResolvedValue(undefined),
    });
    expect(report).toEqual({
      overall: 'ready',
      checks: [
        { id: 'storage', status: 'ready', code: 'ready' },
        { id: 'disk', status: 'ready', code: 'ready' },
        { id: 'java', status: 'ready', code: 'ready' },
        { id: 'network', status: 'ready', code: 'ready' },
      ],
    });
    expect(JSON.stringify(report)).not.toContain('/private');
  });

  it('blocks unwritable storage but treats Java provisioning and network as actionable warnings', async () => {
    const report = await checkSystemReadiness({
      rootPath: '/private/game',
      scanJava: async () => [],
      verifyStorage: vi.fn().mockRejectedValue(new Error('permission denied at /private/game')),
      getFreeBytes: vi.fn().mockResolvedValue(1024),
      verifyNetwork: vi.fn().mockRejectedValue(new Error('offline')),
    });
    expect(report.overall).toBe('blocked');
    expect(report.checks).toEqual([
      { id: 'storage', status: 'blocked', code: 'unwritable' },
      { id: 'disk', status: 'warning', code: 'low-space' },
      { id: 'java', status: 'info', code: 'automatic-download' },
      { id: 'network', status: 'warning', code: 'unreachable' },
    ]);
  });
});
