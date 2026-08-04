// @vitest-environment jsdom

import { act, renderHook, waitFor } from '@testing-library/react';
import type { Dispatch, SetStateAction } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ModpackConfig } from '../../types';

const mocked = vi.hoisted(() => ({
  config: vi.fn().mockResolvedValue({
    ok: true,
    value: { status: 'committed', selectedId: 'pack', instances: [] },
  }),
}));

vi.mock('../../../../services/ipc/instancesIPC', () => ({
  instancesIPC: {
    config: (...args: unknown[]) => mocked.config(...args),
  },
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
    mocked.config.mockClear();
  });

  it('flushes the latest pending config on unmount', async () => {
    const setConfig = vi.fn() as unknown as Dispatch<SetStateAction<ModpackConfig | null>>;
    const { result, unmount } = renderHook(() => useInstanceConfigPersistence({
      setConfig,
    }));

    act(() => {
      void result.current.saveConfig(config);
    });
    unmount();

    await waitFor(() => expect(mocked.config).toHaveBeenCalledWith({
      action: 'save',
      id: config.id,
      config: {
        runtime: { minecraftVersion: '1.21.1', modLoader: { type: 'vanilla' } },
        memory: { maxMb: 4096 },
        vmOptions: [],
      },
    }));
  });

  it('flushes the latest canonical config before unmount', async () => {
    let currentConfig: ModpackConfig | null = config;
    const setConfig: Dispatch<SetStateAction<ModpackConfig | null>> = (next) => {
      currentConfig = typeof next === 'function' ? next(currentConfig) : next;
    };
    const { result, unmount } = renderHook(() => useInstanceConfigPersistence({ setConfig }));

    act(() => {
      result.current.patchConfig({ name: 'Changed' });
    });
    unmount();

    await waitFor(() => {
      expect(mocked.config).toHaveBeenCalledWith(expect.objectContaining({
        action: 'save',
        id: config.id,
      }));
    });
  });
});
