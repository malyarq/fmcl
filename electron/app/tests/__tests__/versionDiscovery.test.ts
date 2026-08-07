import { describe, expect, it, vi } from 'vitest';
import { discoverVersions } from '../versionDiscovery';

describe('full-test version discovery', () => {
  it('preserves the newest-first Mojang manifest order for bounded runs', async () => {
    const getVersionList = vi.fn().mockResolvedValue({
      versions: [
        { id: '1.21.8', type: 'release' },
        { id: '1.20.1', type: 'release' },
        { id: '26w31a', type: 'snapshot' },
        { id: '1.0', type: 'release' },
      ],
    });

    const discovered = await discoverVersions({
      versionLists: { getVersionList } as never,
      providerId: 'mojang',
      enabledStages: new Set(['vanilla']),
      onLog: vi.fn(),
    });

    expect(discovered.allReleaseVersions).toEqual(['1.21.8', '1.20.1', '1.0']);
  });
});
