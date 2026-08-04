// @vitest-environment jsdom

import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CLASSIC_MODPACK_ID } from '../../../../shared/constants';
import type { ModpackConfig } from '../../../contexts/instances/types';

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
import { useInstanceInvalidation } from '../hooks/useInstanceInvalidation';
import { useInstanceConfigCommands } from '../hooks/useInstanceConfigCommands';
import {
  useInstanceList,
  useInstanceSnapshot,
  useSelectedInstance,
} from '../hooks/useInstanceSelectors';

describe('InstanceQueryProvider multi-consumer semantics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    services.fetchInstanceCatalog.mockResolvedValue({ instances: [], selectedId: null });
    services.saveModpackConfig.mockResolvedValue(undefined);
  });

  it('coalesces two mounted selectors for one ID into one canonical request', async () => {
    const request = deferred<ModpackConfig>();
    services.fetchModpackConfig.mockReturnValue(request.promise);

    const { result } = renderHook(() => ({
      first: useInstanceSnapshot('alpha'),
      second: useInstanceSnapshot('alpha'),
    }), { wrapper });

    await waitFor(() => expect(services.fetchModpackConfig).toHaveBeenCalledTimes(1));
    expect(result.current.first.status).toBe('loading');
    expect(result.current.second.status).toBe('loading');

    await act(async () => request.resolve(config('alpha', '1.20.1')));

    await waitFor(() => expect(result.current.first.status).toBe('ready'));
    expect(result.current.first).toBe(result.current.second);
  });

  it('invalidates one ID once and publishes the refreshed value to every subscriber', async () => {
    services.fetchModpackConfig
      .mockResolvedValueOnce(config('alpha', '1.20.1'))
      .mockResolvedValueOnce(config('alpha', '1.21.1'));

    const { result } = renderHook(() => ({
      first: useInstanceSnapshot('alpha'),
      second: useInstanceSnapshot('alpha'),
      invalidation: useInstanceInvalidation(),
    }), { wrapper });

    await waitFor(() => expect(result.current.first.status).toBe('ready'));

    await act(async () => {
      await result.current.invalidation.invalidateInstance('alpha');
    });

    expect(services.fetchModpackConfig).toHaveBeenCalledTimes(2);
    expect(result.current.first).toEqual({ status: 'ready', data: config('alpha', '1.21.1') });
    expect(result.current.first).toBe(result.current.second);
  });

  it('coalesces concurrent invalidation of the same ID into one fresh read', async () => {
    const refresh = deferred<ModpackConfig>();
    services.fetchModpackConfig
      .mockResolvedValueOnce(config('alpha', '1.20.1'))
      .mockReturnValueOnce(refresh.promise);

    const { result } = renderHook(() => ({
      snapshot: useInstanceSnapshot('alpha'),
      invalidation: useInstanceInvalidation(),
    }), { wrapper });
    await waitFor(() => expect(result.current.snapshot.status).toBe('ready'));

    let first!: Promise<void>;
    let second!: Promise<void>;
    act(() => {
      first = result.current.invalidation.invalidateInstance('alpha');
      second = result.current.invalidation.invalidateInstance('alpha');
    });

    expect(services.fetchModpackConfig).toHaveBeenCalledTimes(2);
    await act(async () => refresh.resolve(config('alpha', '1.21.1')));
    await Promise.all([first, second]);
    expect(result.current.snapshot).toEqual({ status: 'ready', data: config('alpha', '1.21.1') });
  });

  it('shares selected, direct and classic snapshots through the same ID-keyed map', async () => {
    services.fetchInstanceCatalog.mockResolvedValue({
      instances: [{
        id: 'alpha',
        name: 'Alpha',
        selected: true,
        summary: { minecraftVersion: '1.21.1', modLoader: { type: 'vanilla' } },
      }],
      selectedId: 'alpha',
    });
    services.fetchModpackConfig.mockImplementation(async (id: string) => config(id, id === 'alpha' ? '1.21.1' : '1.12.2'));

    const { result } = renderHook(() => ({
      list: useInstanceList(),
      selected: useSelectedInstance(),
      direct: useInstanceSnapshot('alpha'),
      classic: useInstanceSnapshot(CLASSIC_MODPACK_ID),
    }), { wrapper });

    await waitFor(() => {
      expect(result.current.selected.status).toBe('ready');
      expect(result.current.classic.status).toBe('ready');
    });

    expect(result.current.list.status).toBe('ready');
    expect(result.current.direct).toEqual({ status: 'ready', data: config('alpha', '1.21.1') });
    expect(services.fetchModpackConfig.mock.calls.filter(([id]) => id === 'alpha')).toHaveLength(1);
    expect(services.fetchModpackConfig.mock.calls.filter(([id]) => id === CLASSIC_MODPACK_ID)).toHaveLength(1);
  });

  it('does not publish a stale response after an ID switch', async () => {
    const alphaFirst = deferred<ModpackConfig>();
    const alphaSecond = deferred<ModpackConfig>();
    const beta = deferred<ModpackConfig>();
    let alphaCalls = 0;
    services.fetchModpackConfig.mockImplementation((id: string) => {
      if (id === 'beta') return beta.promise;
      alphaCalls += 1;
      return alphaCalls === 1 ? alphaFirst.promise : alphaSecond.promise;
    });

    const { result, rerender } = renderHook(
      ({ id }: { id: string }) => useInstanceSnapshot(id),
      { initialProps: { id: 'alpha' }, wrapper },
    );
    await waitFor(() => expect(services.fetchModpackConfig).toHaveBeenCalledWith('alpha'));

    rerender({ id: 'beta' });
    await waitFor(() => expect(services.fetchModpackConfig).toHaveBeenCalledWith('beta'));
    await act(async () => beta.resolve(config('beta', '1.21.1')));
    await waitFor(() => expect(result.current).toEqual({ status: 'ready', data: config('beta', '1.21.1') }));

    await act(async () => alphaFirst.resolve(config('alpha', 'stale')));
    expect(result.current).toEqual({ status: 'ready', data: config('beta', '1.21.1') });

    rerender({ id: 'alpha' });
    await waitFor(() => expect(alphaCalls).toBe(2));
    expect(result.current.status).toBe('loading');
    await act(async () => alphaSecond.resolve(config('alpha', '1.21.1')));
    await waitFor(() => expect(result.current).toEqual({ status: 'ready', data: config('alpha', '1.21.1') }));
  });

  it('drops a response after the last selector unmounts and performs a fresh read on return', async () => {
    const first = deferred<ModpackConfig>();
    const second = deferred<ModpackConfig>();
    services.fetchModpackConfig
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    const { result, rerender } = renderHook(
      ({ visible }: { visible: boolean }) => useInstanceSnapshot(visible ? 'alpha' : null),
      { initialProps: { visible: true }, wrapper },
    );
    await waitFor(() => expect(services.fetchModpackConfig).toHaveBeenCalledTimes(1));

    rerender({ visible: false });
    await act(async () => first.resolve(config('alpha', 'stale')));
    expect(result.current).toEqual({ status: 'idle' });

    rerender({ visible: true });
    await waitFor(() => expect(services.fetchModpackConfig).toHaveBeenCalledTimes(2));
    expect(result.current.status).toBe('loading');
    await act(async () => second.resolve(config('alpha', '1.21.1')));
    await waitFor(() => expect(result.current.status).toBe('ready'));
  });

  it('serializes config writes while publishing one merged optimistic snapshot', async () => {
    const firstSave = deferred<void>();
    const secondSave = deferred<void>();
    let canonical = config('alpha', '1.21.1');
    services.fetchModpackConfig.mockImplementation(async () => canonical);
    services.saveModpackConfig.mockImplementation((next: ModpackConfig) => {
      canonical = next;
      return services.saveModpackConfig.mock.calls.length === 1 ? firstSave.promise : secondSave.promise;
    });

    const { result } = renderHook(() => ({
      snapshot: useInstanceSnapshot('alpha'),
      commands: useInstanceConfigCommands('alpha'),
    }), { wrapper });
    await waitFor(() => expect(result.current.snapshot.status).toBe('ready'));

    let memorySave!: Promise<void>;
    let optionsSave!: Promise<void>;
    act(() => {
      memorySave = result.current.commands.setMemoryGb(6);
      optionsSave = result.current.commands.setVmOptions(['-XX:+UseG1GC']);
    });

    expect(result.current.snapshot).toEqual({
      status: 'ready',
      data: expect.objectContaining({
        memory: { maxMb: 6144 },
        vmOptions: ['-XX:+UseG1GC'],
      }),
    });
    await waitFor(() => expect(services.saveModpackConfig).toHaveBeenCalledTimes(1));

    await act(async () => firstSave.resolve());
    await waitFor(() => expect(services.saveModpackConfig).toHaveBeenCalledTimes(2));
    await act(async () => secondSave.resolve());
    await Promise.all([memorySave, optionsSave]);

    expect(services.saveModpackConfig.mock.calls[1]?.[0]).toEqual(expect.objectContaining({
      memory: { maxMb: 6144 },
      vmOptions: ['-XX:+UseG1GC'],
    }));
    expect(result.current.snapshot.status).toBe('ready');
  });
});

function wrapper(props: { children: ReactNode }) {
  return <InstanceQueryProvider>{props.children}</InstanceQueryProvider>;
}

function config(id: string, minecraft: string): ModpackConfig {
  return {
    id,
    name: id === 'alpha' ? 'Alpha' : id === 'beta' ? 'Beta' : 'Classic',
    runtime: { minecraft, modLoader: { type: 'vanilla' } },
    memory: { maxMb: 4096 },
    vmOptions: [],
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}
