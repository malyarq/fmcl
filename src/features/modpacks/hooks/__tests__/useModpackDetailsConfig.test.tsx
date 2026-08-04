// @vitest-environment jsdom

import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ModpackConfig } from '../../../../contexts/instances/types';

const services = vi.hoisted(() => ({
  fetchInstanceCatalog: vi.fn(),
  fetchModpackConfig: vi.fn(),
  saveModpackConfig: vi.fn(),
  configs: new Map<string, ModpackConfig>(),
}));

vi.mock('../../../../contexts/instances/services/instancesService', () => ({
  fetchInstanceCatalog: (...args: unknown[]) => services.fetchInstanceCatalog(...args),
  fetchModpackConfig: (...args: unknown[]) => services.fetchModpackConfig(...args),
  saveModpackConfig: (...args: unknown[]) => services.saveModpackConfig(...args),
}));

import { InstanceQueryProvider } from '../../../instances/InstanceQueryProvider';
import { useModpackDetailsConfig } from '../useModpackDetailsConfig';

describe('useModpackDetailsConfig canonical ownership', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    services.configs.clear();
    services.configs.set('alpha', config('alpha', '1.20.1'));
    services.configs.set('beta', config('beta', '1.19.4'));
    services.fetchInstanceCatalog.mockResolvedValue({
      instances: [
        { id: 'alpha', name: 'Alpha', selected: true, summary: { minecraftVersion: '1.20.1', modLoader: { type: 'vanilla' } } },
        { id: 'beta', name: 'Beta', selected: false, summary: { minecraftVersion: '1.19.4', modLoader: { type: 'vanilla' } } },
      ],
      selectedId: 'alpha',
    });
    services.fetchModpackConfig.mockImplementation(async (id: string) => {
      const value = services.configs.get(id);
      if (!value) throw new Error('Missing fixture');
      return value;
    });
    services.saveModpackConfig.mockImplementation(async (next: ModpackConfig) => {
      services.configs.set(next.id, next);
    });
  });

  it.each(['alpha', 'beta'])('edits %s through the same ID-keyed owner', async (id) => {
    const { result } = renderHook(() => useModpackDetailsConfig({ modpackId: id }), { wrapper });
    await waitFor(() => expect(result.current.effectiveConfig?.id).toBe(id));

    await act(async () => result.current.setters.setMemoryGb(6));

    expect(services.saveModpackConfig).toHaveBeenCalledWith(expect.objectContaining({
      id,
      memory: { maxMb: 6144 },
    }));
    expect(result.current.effectiveConfig?.memory?.maxMb).toBe(6144);
  });

  it('invalidates the requested ID in place without a local detail cache', async () => {
    const { result } = renderHook(() => useModpackDetailsConfig({ modpackId: 'beta' }), { wrapper });
    await waitFor(() => expect(result.current.effectiveConfig?.runtime.minecraft).toBe('1.19.4'));
    services.configs.set('beta', config('beta', '1.21.1'));

    await act(async () => result.current.loadModpackConfig());

    expect(result.current.effectiveConfig?.runtime.minecraft).toBe('1.21.1');
    expect(services.fetchModpackConfig.mock.calls.filter(([id]) => id === 'beta')).toHaveLength(2);
  });

  it('keeps loader and OptiFine compatibility in one canonical save', async () => {
    services.configs.set('beta', {
      ...config('beta', '1.20.1'),
      runtime: { minecraft: '1.20.1', modLoader: { type: 'forge', version: '47.0.0' } },
      game: { useOptiFine: true },
    });
    const { result } = renderHook(() => useModpackDetailsConfig({ modpackId: 'beta' }), { wrapper });
    await waitFor(() => expect(result.current.effectiveConfig?.game?.useOptiFine).toBe(true));

    await act(async () => result.current.setters.setRuntimeLoader('fabric'));

    expect(result.current.effectiveConfig).toEqual(expect.objectContaining({
      runtime: { minecraft: '1.20.1', modLoader: { type: 'fabric' } },
      game: { useOptiFine: false },
    }));
  });
});

function wrapper(props: { children: ReactNode }) {
  return <InstanceQueryProvider>{props.children}</InstanceQueryProvider>;
}

function config(id: string, minecraft: string): ModpackConfig {
  return {
    id,
    name: id === 'alpha' ? 'Alpha' : 'Beta',
    runtime: { minecraft, modLoader: { type: 'vanilla' } },
    memory: { maxMb: 4096 },
    vmOptions: [],
  };
}
