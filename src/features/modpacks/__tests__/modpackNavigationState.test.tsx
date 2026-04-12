// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ModpackSearchResultItem, ModpackVersionDescriptor } from '@shared/contracts/modpacks';
import {
  DEFAULT_MODPACK_BROWSER_STATE,
  type ModpackBrowserState,
  useModpackNavigation,
} from '../hooks/useModpackNavigation';

const sampleModpack: ModpackSearchResultItem = {
  platform: 'modrinth',
  projectId: 'adventure-pack',
  title: 'Adventure Pack',
};

const sampleVersion: ModpackVersionDescriptor = {
  platform: 'modrinth',
  versionId: '1.0.0',
  name: '1.0.0',
  mcVersions: ['1.20.1'],
  loaders: ['fabric'],
  files: [],
};

function createBrowserState(overrides: Partial<ModpackBrowserState> = {}): ModpackBrowserState {
  return {
    ...DEFAULT_MODPACK_BROWSER_STATE,
    ...overrides,
  };
}

describe('useModpackNavigation', () => {
  it('returns to the preserved browser state after leaving for install flow', () => {
    const { result } = renderHook(() => useModpackNavigation());
    const browserState = createBrowserState({
      query: 'fabric',
      filterLoader: 'fabric',
      currentPage: 3,
      itemsPerPage: 24,
      showHistory: true,
    });

    act(() => {
      result.current.navigate({ type: 'browser', state: browserState });
    });

    act(() => {
      result.current.navigate({
        type: 'install',
        modpack: sampleModpack,
        versions: [sampleVersion],
        platform: 'modrinth',
      });
    });

    act(() => {
      result.current.goBack();
    });

    expect(result.current.view).toEqual({
      type: 'browser',
      state: browserState,
    });
  });

  it('replaces the current browser snapshot instead of pushing another history entry', () => {
    const { result } = renderHook(() => useModpackNavigation());
    const initialBrowserState = createBrowserState({ query: 'sky' });
    const updatedBrowserState = createBrowserState({
      query: 'skyblock',
      currentPage: 2,
      itemsPerPage: 48,
    });

    act(() => {
      result.current.navigate({ type: 'browser', state: initialBrowserState });
    });

    act(() => {
      result.current.replace({ type: 'browser', state: updatedBrowserState });
    });

    act(() => {
      result.current.goBack();
    });

    expect(result.current.view).toEqual({ type: 'list' });
  });

  it('preserves the latest browser snapshot across import-preview round-trips', () => {
    const { result } = renderHook(() => useModpackNavigation());
    const browserState = createBrowserState({
      query: 'kitchen sink',
      sortBy: 'date',
      filterMCVersion: '1.21.1',
      currentPage: 4,
    });

    act(() => {
      result.current.navigate({ type: 'browser', state: browserState });
    });

    act(() => {
      result.current.navigate({ type: 'importPreview', filePath: '/tmp/modpack.mrpack' });
    });

    act(() => {
      result.current.goBack();
    });

    expect(result.current.view).toEqual({
      type: 'browser',
      state: browserState,
    });
  });
});
