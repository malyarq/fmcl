// @vitest-environment jsdom

import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  AcquisitionOutcome,
  ContentAcquisitionAdapter,
  ContentAcquisitionItem,
  ContentAcquisitionSelection,
  ContentRuntimeInput,
} from '../contentAcquisitionTypes';
import { useContentAcquisitionState } from '../hooks/useContentAcquisitionState';
import acquisitionTypesSource from '../contentAcquisitionTypes.ts?raw';

type Item = ContentAcquisitionItem & { source: string };
type Selection = ContentAcquisitionSelection & { versionId: string };

const item = (id: string): Item => ({ id, label: `Item ${id}`, source: 'fixture' });
const selection = (id: string): Selection => ({ id, label: `Item ${id}`, versionId: `version-${id}` });

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
}

function adapter<K extends 'mod' | 'resourcepack' | 'shader'>(kind: K) {
  return {
    kind,
    search: vi.fn(),
    resolveSelection: vi.fn(async ({ item: nextItem }: { item: Item }) => selection(nextItem.id)),
    install: vi.fn(),
    ...(kind === 'mod' ? {} : { importLocal: vi.fn() }),
  } as unknown as ContentAcquisitionAdapter<K, Item, Selection>;
}

function runtime<K extends 'mod' | 'resourcepack' | 'shader'>(kind: K): ContentRuntimeInput<K> {
  if (kind === 'shader') {
    return { instanceId: 'alpha', minecraftVersion: '1.20.1', shaderSupport: 'supported' } as ContentRuntimeInput<K>;
  }
  return { instanceId: 'alpha', minecraftVersion: '1.20.1' } as ContentRuntimeInput<K>;
}

describe('useContentAcquisitionState', () => {
  afterEach(() => vi.useRealTimers());

  it.each(['mod', 'resourcepack', 'shader'] as const)('passes only typed %s runtime/search input to its adapter', async (kind) => {
    const fake = adapter(kind);
    vi.mocked(fake.search).mockResolvedValue({ items: [], nextPage: null });

    renderHook(() => useContentAcquisitionState({
      adapter: fake,
      runtime: runtime(kind),
      debounceMs: 0,
      initialFilters: { sort: 'popular' },
    }));

    await waitFor(() => expect(fake.search).toHaveBeenCalledWith({
      kind,
      query: '',
      filters: { sort: 'popular' },
      page: 0,
      runtime: runtime(kind),
    }));
    expect(acquisitionTypesSource).not.toMatch(/services\/ipc|modsIPC|resourcePacksIPC|shadersIPC|rootPath|filePath/);
  });

  it('debounces queries and prevents a stale search from overwriting the newest page', async () => {
    vi.useFakeTimers();
    const fake = adapter('mod');
    const oldSearch = deferred<{ items: Item[]; nextPage: null }>();
    const newSearch = deferred<{ items: Item[]; nextPage: null }>();
    vi.mocked(fake.search).mockImplementation(({ query }) => (
      query === 'old' ? oldSearch.promise : newSearch.promise
    ));

    const { result } = renderHook(() => useContentAcquisitionState({
      adapter: fake,
      runtime: runtime('mod'),
      debounceMs: 250,
      initialQuery: 'old',
    }));
    await act(async () => {});
    expect(fake.search).toHaveBeenCalledTimes(1);

    act(() => result.current.setQuery('new'));
    await act(async () => vi.advanceTimersByTime(250));
    expect(fake.search).toHaveBeenCalledTimes(2);

    await act(async () => newSearch.resolve({ items: [item('new')], nextPage: null }));
    expect(result.current.items.map(({ id }) => id)).toEqual(['new']);
    await act(async () => oldSearch.resolve({ items: [item('old')], nextPage: null }));
    expect(result.current.items.map(({ id }) => id)).toEqual(['new']);
  });

  it('shares paging, checked selection and filter reset without knowing version semantics', async () => {
    const fake = adapter('resourcepack');
    vi.mocked(fake.search)
      .mockResolvedValueOnce({ items: [item('a'), item('b')], nextPage: 1, total: 3 })
      .mockResolvedValueOnce({ items: [item('c')], nextPage: null, total: 3 })
      .mockResolvedValue({ items: [item('filtered')], nextPage: null, total: 1 });

    const { result } = renderHook(() => useContentAcquisitionState({
      adapter: fake,
      runtime: runtime('resourcepack'),
      debounceMs: 0,
    }));
    await waitFor(() => expect(result.current.items).toHaveLength(2));

    await act(async () => result.current.toggle(item('a'), true));
    expect([...result.current.checkedIds]).toEqual(['a']);
    expect(result.current.selections.get('a')).toMatchObject({ versionId: 'version-a' });

    await act(async () => result.current.loadNextPage());
    expect(result.current.items.map(({ id }) => id)).toEqual(['a', 'b', 'c']);

    act(() => result.current.setFilter('loader', 'fabric'));
    expect([...result.current.checkedIds]).toEqual([]);
    await waitFor(() => expect(fake.search).toHaveBeenLastCalledWith(expect.objectContaining({
      filters: { loader: 'fabric' },
      page: 0,
    })));

    act(() => result.current.reset());
    expect(result.current.query).toBe('');
    expect([...result.current.checkedIds]).toEqual([]);
    await waitFor(() => expect(fake.search).toHaveBeenLastCalledWith(expect.objectContaining({
      filters: {},
      page: 0,
    })));
  });

  it('retains only failed selections after partial commit and retries those selections', async () => {
    const fake = adapter('shader');
    vi.mocked(fake.search).mockResolvedValue({ items: [item('a'), item('b')], nextPage: null });
    const partial: AcquisitionOutcome = {
      didCommit: true,
      isPresentationSuccess: false,
      committedSelectionIds: ['a'],
      retainedSelectionIds: ['b'],
      issues: [{ selectionId: 'b', label: 'Item b', code: 'runtime-blocked' }],
    };
    const success: AcquisitionOutcome = {
      didCommit: true,
      isPresentationSuccess: true,
      committedSelectionIds: ['b'],
      retainedSelectionIds: [],
      issues: [],
    };
    vi.mocked(fake.install).mockResolvedValueOnce(partial).mockResolvedValueOnce(success);

    const { result } = renderHook(() => useContentAcquisitionState({
      adapter: fake,
      runtime: runtime('shader'),
      debounceMs: 0,
    }));
    await waitFor(() => expect(result.current.items).toHaveLength(2));
    await act(async () => {
      await result.current.toggle(item('a'), true);
      await result.current.toggle(item('b'), true);
    });

    await act(async () => result.current.installSelected());
    expect([...result.current.checkedIds]).toEqual(['b']);
    expect(result.current.outcome).toEqual(partial);

    await act(async () => result.current.retryFailed());
    expect(fake.install).toHaveBeenLastCalledWith({
      selections: [selection('b')],
      runtime: runtime('shader'),
    });
    expect([...result.current.checkedIds]).toEqual([]);
    expect(result.current.outcome).toEqual(success);
  });

  it('retries a retained local import through the local adapter instead of an empty catalog install', async () => {
    const fake = adapter('resourcepack');
    vi.mocked(fake.search).mockResolvedValue({ items: [], nextPage: null });
    const partial: AcquisitionOutcome = {
      didCommit: true,
      isPresentationSuccess: false,
      committedSelectionIds: ['local:clean.zip'],
      retainedSelectionIds: ['local:broken.zip'],
      issues: [{ selectionId: 'local:broken.zip', label: 'broken.zip', code: 'invalid-archive' }],
    };
    const success: AcquisitionOutcome = {
      didCommit: true,
      isPresentationSuccess: true,
      committedSelectionIds: ['local:broken.zip'],
      retainedSelectionIds: [],
      issues: [],
    };
    vi.mocked(fake.importLocal!).mockResolvedValueOnce(partial).mockResolvedValueOnce(success);

    const { result } = renderHook(() => useContentAcquisitionState({
      adapter: fake,
      runtime: runtime('resourcepack'),
      debounceMs: 0,
    }));
    await waitFor(() => expect(result.current.searchStatus).toBe('ready'));

    await act(async () => result.current.importLocal());
    expect(result.current.outcome).toEqual(partial);

    await act(async () => result.current.retryFailed());
    expect(fake.importLocal).toHaveBeenCalledTimes(2);
    expect(fake.install).not.toHaveBeenCalled();
    expect(result.current.outcome).toEqual(success);
  });
});
