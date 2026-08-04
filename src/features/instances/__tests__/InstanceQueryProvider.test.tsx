// @vitest-environment jsdom

import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ModpackConfig, ModpackListItem } from '../../../contexts/instances/types';

const services = vi.hoisted(() => ({
  fetchInstanceCatalog: vi.fn(),
  fetchModpackConfig: vi.fn(),
  saveModpackConfig: vi.fn(),
}));

vi.mock('../../../contexts/instances/services/instancesService', () => ({
  fetchInstanceCatalog: (...args: unknown[]) => services.fetchInstanceCatalog(...args),
  fetchModpackConfig: (...args: unknown[]) => services.fetchModpackConfig(...args),
  saveModpackConfig: (...args: unknown[]) => services.saveModpackConfig(...args),
}));

import { InstanceQueryProvider } from '../InstanceQueryProvider';
import {
  useInstanceList,
  useInstanceSnapshot,
  useSelectedInstance,
} from '../hooks/useInstanceSelectors';
import { useInstanceInvalidation } from '../hooks/useInstanceInvalidation';

const alphaList: ModpackListItem[] = [{
  id: 'alpha',
  name: 'Alpha',
  selected: true,
  summary: { minecraftVersion: '1.21.1', modLoader: { type: 'vanilla' } },
}];

describe('InstanceQueryProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    services.fetchInstanceCatalog.mockResolvedValue({ instances: alphaList, selectedId: 'alpha' });
    services.fetchModpackConfig.mockResolvedValue(config('alpha', '1.21.1'));
    services.saveModpackConfig.mockResolvedValue(undefined);
  });

  it('mounts one explicit list/selection owner and resolves the selected snapshot', async () => {
    const { result } = renderHook(() => ({
      list: useInstanceList(),
      selected: useSelectedInstance(),
    }), { wrapper });

    await waitFor(() => expect(result.current.selected.status).toBe('ready'));

    expect(result.current.list).toEqual({ status: 'ready', data: alphaList });
    expect(result.current.selected).toEqual({
      status: 'ready',
      data: { id: 'alpha', snapshot: config('alpha', '1.21.1') },
    });
    expect(services.fetchInstanceCatalog).toHaveBeenCalledTimes(1);
    expect(services.fetchModpackConfig).toHaveBeenCalledTimes(1);
  });

  it('keeps an uninitialized canonical selection explicit without constructing a default', async () => {
    services.fetchInstanceCatalog.mockResolvedValue({ instances: [], selectedId: null });

    const { result } = renderHook(() => ({
      list: useInstanceList(),
      selected: useSelectedInstance(),
    }), { wrapper });

    await waitFor(() => expect(result.current.selected.status).toBe('uninitialized'));

    expect(result.current.list).toEqual({ status: 'ready', data: [] });
    expect(result.current.selected).toEqual({ status: 'uninitialized' });
    expect(services.fetchModpackConfig).not.toHaveBeenCalled();
  });

  it('publishes typed query failures instead of stale data or fallback values', async () => {
    services.fetchModpackConfig.mockRejectedValue(Object.assign(new Error('Snapshot unavailable'), {
      name: 'SNAPSHOT_UNAVAILABLE',
    }));

    const { result } = renderHook(() => useInstanceSnapshot('alpha'), { wrapper });

    await waitFor(() => expect(result.current.status).toBe('error'));

    expect(result.current).toEqual({
      status: 'error',
      error: { code: 'SNAPSHOT_UNAVAILABLE', message: 'Snapshot unavailable' },
    });
  });

  it('coalesces concurrent whole-store invalidation into one catalog refresh', async () => {
    const nextCatalog = deferred<{ instances: ModpackListItem[]; selectedId: string | null }>();
    const { result } = renderHook(() => ({
      list: useInstanceList(),
      invalidation: useInstanceInvalidation(),
    }), { wrapper });
    await waitFor(() => expect(result.current.list.status).toBe('ready'));

    services.fetchInstanceCatalog.mockReturnValueOnce(nextCatalog.promise);

    let first!: Promise<void>;
    let second!: Promise<void>;
    act(() => {
      first = result.current.invalidation.invalidateInstances();
      second = result.current.invalidation.invalidateInstances();
    });

    expect(services.fetchInstanceCatalog).toHaveBeenCalledTimes(2);
    await act(async () => {
      nextCatalog.resolve({ instances: alphaList, selectedId: 'alpha' });
    });
    await Promise.all([first, second]);
    expect(result.current.list).toEqual({ status: 'ready', data: alphaList });
  });

  it('rejects selector use outside the mounted owner', () => {
    expect(() => renderHook(() => useInstanceList())).toThrow(
      'Instance query selectors require InstanceQueryProvider',
    );
  });
});

function wrapper(props: { children: ReactNode }) {
  return <InstanceQueryProvider>{props.children}</InstanceQueryProvider>;
}

function config(id: string, minecraft: string): ModpackConfig {
  return {
    id,
    name: id === 'alpha' ? 'Alpha' : id,
    runtime: { minecraft, modLoader: { type: 'vanilla' } },
    memory: { maxMb: 4096 },
    vmOptions: [],
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}
