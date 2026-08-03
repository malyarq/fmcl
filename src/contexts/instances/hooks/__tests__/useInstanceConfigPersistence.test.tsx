// @vitest-environment jsdom

import { act, renderHook, waitFor } from '@testing-library/react';
import type { Dispatch, SetStateAction } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ModpackConfig } from '../../types';

const mocked = vi.hoisted(() => ({
  saveModpackConfig: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../services/instancesService', () => ({
  saveModpackConfig: mocked.saveModpackConfig,
}));

import { useInstanceConfigPersistence } from '../useInstanceConfigPersistence';

const config: ModpackConfig = {
  id: 'pack',
  name: 'Pack',
  runtime: { minecraft: '1.21.1', modLoader: { type: 'vanilla' } },
  memory: { maxMb: 4096 },
  vmOptions: [],
  createdAt: '2026-08-03T00:00:00.000Z',
  updatedAt: '2026-08-03T00:00:00.000Z',
};

describe('useInstanceConfigPersistence', () => {
  afterEach(() => {
    mocked.saveModpackConfig.mockClear();
  });

  it('flushes the latest pending config on unmount', async () => {
    const setConfig = vi.fn() as unknown as Dispatch<SetStateAction<ModpackConfig | null>>;
    const { result, unmount } = renderHook(() => useInstanceConfigPersistence({
      rootPath: '/launcher-one',
      setConfig,
    }));

    act(() => {
      void result.current.saveConfig(config);
    });
    unmount();

    await waitFor(() => {
      expect(mocked.saveModpackConfig).toHaveBeenCalledWith(config, '/launcher-one');
    });
  });

  it('flushes to the previous root before a root switch can replace pending data', async () => {
    let currentConfig: ModpackConfig | null = config;
    const setConfig: Dispatch<SetStateAction<ModpackConfig | null>> = (next) => {
      currentConfig = typeof next === 'function' ? next(currentConfig) : next;
    };
    const { result, rerender } = renderHook(
      ({ rootPath }) => useInstanceConfigPersistence({ rootPath, setConfig }),
      { initialProps: { rootPath: '/launcher-one' } },
    );

    act(() => {
      result.current.patchConfig({ name: 'Changed' });
    });
    rerender({ rootPath: '/launcher-two' });

    await waitFor(() => {
      expect(mocked.saveModpackConfig).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Changed' }),
        '/launcher-one',
      );
    });
  });
});
