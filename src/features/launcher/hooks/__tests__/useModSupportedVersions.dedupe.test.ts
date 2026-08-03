// @vitest-environment jsdom

import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useModSupportedVersions } from '../useModSupportedVersions';

const versionApi = vi.hoisted(() => ({
  fetchForgeSupportedVersions: vi.fn(),
  fetchFabricSupportedVersions: vi.fn(),
  fetchOptiFineSupportedVersions: vi.fn(),
  fetchNeoForgeSupportedVersions: vi.fn(),
}));

vi.mock('../../../../services/versions/versionApi', () => versionApi);

describe('useModSupportedVersions refresh sharing', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('shares one network refresh between concurrent hook consumers', async () => {
    let resolveFetch!: (versions: string[]) => void;
    const pendingFetch = new Promise<string[]>((resolve) => {
      resolveFetch = resolve;
    });
    for (const fetchVersions of Object.values(versionApi)) {
      fetchVersions.mockReturnValue(pendingFetch);
    }

    const first = renderHook(() => useModSupportedVersions());
    const second = renderHook(() => useModSupportedVersions());

    for (const fetchVersions of Object.values(versionApi)) {
      expect(fetchVersions).toHaveBeenCalledTimes(1);
    }

    act(() => resolveFetch(['1.20.1']));
    await waitFor(() => {
      expect(first.result.current.forgeVersions).toEqual(['1.20.1']);
      expect(second.result.current.forgeVersions).toEqual(['1.20.1']);
    });
  });
});
