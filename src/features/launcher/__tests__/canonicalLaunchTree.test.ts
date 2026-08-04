// @vitest-environment jsdom

import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useLauncherState, type LauncherVersionInventory } from '../hooks/useLauncherState';
import {
  computeLaunchVersion,
  formatLastLaunch,
  isLoaderSupported,
  loadPlayerNickname,
  loadRecentLaunch,
  saveRecentLaunch,
  shouldDisableOptiFine,
  type RecentLaunch,
} from '../services/launcherService';

const mocked = vi.hoisted(() => ({
  setRuntimeMinecraft: vi.fn(),
  setRuntimeLoader: vi.fn(),
  patchConfig: vi.fn(),
  config: {
    runtime: { minecraft: '1.20.1', modLoader: { type: 'forge' as const } },
    game: { useOptiFine: true },
  },
}));

vi.mock('../../../contexts/ModpackContext', () => ({
  useModpack: () => ({
    config: mocked.config,
    isReady: true,
    setRuntimeMinecraft: mocked.setRuntimeMinecraft,
    setRuntimeLoader: mocked.setRuntimeLoader,
    patchConfig: mocked.patchConfig,
  }),
}));

const versionInventory = {
  forgeVersions: ['1.20.1'],
  fabricVersions: ['1.20.1'],
  neoForgeVersions: ['1.20.1'],
  optiFineVersions: ['1.20.1'],
};

describe('canonical launcher behavior transfer', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: true });
  });

  it('preserves every characterized loader validation and launch-version outcome', () => {
    const loaders = ['vanilla', 'forge', 'fabric', 'neoforge', 'quilt'] as const;
    const versions = ['1.20.1', '1.19.4'];

    for (const loaderType of loaders) {
      for (const mcVersion of versions) {
        const support = { loaderType, mcVersion, ...versionInventory };
        const expectedSupported = loaderType === 'vanilla' || loaderType === 'quilt' || mcVersion === '1.20.1';
        expect(isLoaderSupported(support)).toBe(expectedSupported);
        const expectedLaunchVersion = loaderType === 'forge' ? `${mcVersion}-Forge`
          : loaderType === 'fabric' ? `${mcVersion}-Fabric`
            : loaderType === 'neoforge' ? `${mcVersion}-NeoForge`
              : mcVersion;
        expect(computeLaunchVersion({ loaderType, mcVersion })).toBe(expectedLaunchVersion);
        const optifine = {
          useOptiFine: true,
          loaderType,
          mcVersion,
          optiFineVersions: versionInventory.optiFineVersions,
        };
        expect(shouldDisableOptiFine(optifine)).toBe(loaderType !== 'forge' || mcVersion !== '1.20.1');
      }
    }
  });

  it('keeps nickname persistence compatible with the established storage contract', () => {
    expect(loadPlayerNickname()).toBe('Player');

    localStorage.setItem('nickname', 'Alex');
    expect(loadPlayerNickname()).toBe('Alex');
  });

  it('reads and writes the established per-instance launch history contract', () => {
    const record: RecentLaunch = {
      versionId: '1.20.1',
      nickname: 'Alex',
      loader: 'fabric',
      launchVersion: '1.20.1-Fabric',
      timestamp: 1_720_000_000_000,
    };

    saveRecentLaunch('alpha', record);
    expect(loadRecentLaunch('alpha')).toEqual(record);
    expect(formatLastLaunch(record.timestamp, (key) => key)).toBe(
      new Date(record.timestamp).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }),
    );
  });

  it('migrates the classic legacy history key once and rejects malformed history', () => {
    const record: RecentLaunch = {
      versionId: '1.20.1',
      nickname: 'Alex',
      loader: 'vanilla',
      launchVersion: '1.20.1',
      timestamp: 1_720_000_000_000,
    };
    localStorage.setItem('simple_play_lastGame', JSON.stringify(record));

    expect(loadRecentLaunch('classic')).toEqual(record);
    expect(localStorage.getItem('simple_play_lastGame')).toBeNull();
    expect(loadRecentLaunch('classic')).toEqual(record);

    localStorage.setItem('lastGame_broken', JSON.stringify({ ...record, loader: 'unknown' }));
    expect(loadRecentLaunch('broken')).toBeNull();
  });

  it('owns selection, nickname and network state without inventing hidden instance persistence', async () => {
    const { result, unmount } = renderHook(() => useLauncherState(versionInventory));

    expect(result.current).toMatchObject({
      nickname: 'Player',
      version: '1.20.1',
      loaderType: 'forge',
      useForge: true,
      useFabric: false,
      useNeoForge: false,
      useOptiFine: true,
      isOffline: false,
      launchVersion: '1.20.1-Forge',
    });

    act(() => result.current.setVersion('1.19.4'));
    expect(mocked.setRuntimeMinecraft).toHaveBeenCalledWith('1.19.4');

    act(() => result.current.setLoader('fabric'));
    expect(mocked.setRuntimeLoader).toHaveBeenCalledWith('fabric');

    act(() => result.current.setNickname('Steve'));
    await waitFor(() => expect(localStorage.getItem('nickname')).toBe('Steve'));
    expect(Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index))).toEqual(['nickname']);

    act(() => window.dispatchEvent(new Event('offline')));
    expect(result.current.isOffline).toBe(true);
    act(() => window.dispatchEvent(new Event('online')));
    expect(result.current.isOffline).toBe(false);

    unmount();
    act(() => window.dispatchEvent(new Event('offline')));
  });

  it('cancels stale compatibility resets when support data changes or the hook unmounts', () => {
    vi.useFakeTimers();
    try {
      const unsupported: LauncherVersionInventory = {
        forgeVersions: [],
        fabricVersions: [],
        neoForgeVersions: [],
        optiFineVersions: [],
      };
      const { rerender, unmount } = renderHook(
        ({ inventory }) => useLauncherState(inventory),
        { initialProps: { inventory: unsupported } },
      );

      rerender({ inventory: versionInventory });
      act(() => vi.runAllTimers());
      expect(mocked.setRuntimeLoader).not.toHaveBeenCalled();
      expect(mocked.patchConfig).not.toHaveBeenCalled();

      rerender({ inventory: unsupported });
      unmount();
      act(() => vi.runAllTimers());
      expect(mocked.setRuntimeLoader).not.toHaveBeenCalled();
      expect(mocked.patchConfig).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
