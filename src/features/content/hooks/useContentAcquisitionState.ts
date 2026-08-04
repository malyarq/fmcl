import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  AcquisitionOutcome,
  ContentAcquisitionAdapter,
  ContentAcquisitionController,
  ContentAcquisitionFilters,
  ContentAcquisitionItem,
  ContentAcquisitionKind,
  ContentAcquisitionSelection,
  ContentRuntimeInput,
} from '../contentAcquisitionTypes';

function contentRuntimeKey(runtime: ContentRuntimeInput<ContentAcquisitionKind>) {
  return [
    runtime.instanceId,
    runtime.minecraftVersion ?? '',
    'loader' in runtime ? runtime.loader ?? '' : '',
    'shaderSupport' in runtime ? runtime.shaderSupport : '',
  ].join('\u0000');
}

export type UseContentAcquisitionStateOptions<
  K extends ContentAcquisitionKind,
  Item extends ContentAcquisitionItem,
  Selection extends ContentAcquisitionSelection,
> = {
  adapter: ContentAcquisitionAdapter<K, Item, Selection>;
  runtime: ContentRuntimeInput<K>;
  initialQuery?: string;
  initialFilters?: ContentAcquisitionFilters;
  debounceMs?: number;
};

export function useContentAcquisitionState<
  K extends ContentAcquisitionKind,
  Item extends ContentAcquisitionItem,
  Selection extends ContentAcquisitionSelection,
>({
  adapter,
  runtime,
  initialQuery = '',
  initialFilters = {},
  debounceMs = 300,
}: UseContentAcquisitionStateOptions<K, Item, Selection>): ContentAcquisitionController<Item, Selection> {
  const [query, setQueryState] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);
  const [filters, setFilters] = useState<ContentAcquisitionFilters>({ ...initialFilters });
  const [items, setItems] = useState<readonly Item[]>([]);
  const [nextPage, setNextPage] = useState<number | null>(null);
  const [total, setTotal] = useState<number | undefined>(undefined);
  const [checkedIds, setCheckedIds] = useState<ReadonlySet<string>>(new Set());
  const [resolvingIds, setResolvingIds] = useState<ReadonlySet<string>>(new Set());
  const [selections, setSelections] = useState<ReadonlyMap<string, Selection>>(new Map());
  const [searchStatus, setSearchStatus] = useState<ContentAcquisitionController<Item, Selection>['searchStatus']>('idle');
  const [isInstalling, setIsInstalling] = useState(false);
  const [isImportingLocal, setIsImportingLocal] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [outcome, setOutcome] = useState<AcquisitionOutcome | null>(null);

  const mountedRef = useRef(true);
  const runtimeRef = useRef(runtime);
  const searchGenerationRef = useRef(0);
  const selectionGenerationRef = useRef(new Map<string, number>());
  const checkedRef = useRef<ReadonlySet<string>>(new Set());
  const selectionsRef = useRef<ReadonlyMap<string, Selection>>(new Map());
  const installingRef = useRef(false);
  const importingLocalRef = useRef(false);
  const lastMutationRef = useRef<'catalog' | 'local' | null>(null);
  runtimeRef.current = runtime;

  const runtimeKey = contentRuntimeKey(runtime);

  const publishChecked = useCallback((next: ReadonlySet<string>) => {
    checkedRef.current = next;
    setCheckedIds(next);
  }, []);

  const publishSelections = useCallback((next: ReadonlyMap<string, Selection>) => {
    selectionsRef.current = next;
    setSelections(next);
  }, []);

  const clearSelection = useCallback(() => {
    selectionGenerationRef.current.clear();
    publishChecked(new Set());
    publishSelections(new Map());
    setResolvingIds(new Set());
  }, [publishChecked, publishSelections]);

  useEffect(() => {
    const selectionGenerations = selectionGenerationRef.current;
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      searchGenerationRef.current += 1;
      selectionGenerations.clear();
    };
  }, []);

  useEffect(() => {
    if (debounceMs <= 0) {
      setDebouncedQuery(query);
      return;
    }
    const timeoutId = window.setTimeout(() => setDebouncedQuery(query), debounceMs);
    return () => window.clearTimeout(timeoutId);
  }, [debounceMs, query]);

  const executeSearch = useCallback(async (page: number, append: boolean) => {
    const requestRuntime = runtimeRef.current;
    if (contentRuntimeKey(requestRuntime) !== runtimeKey) return;
    const generation = ++searchGenerationRef.current;
    setSearchStatus(append ? 'loading-more' : 'loading');
    setError(null);

    try {
      const result = await adapter.search({
        kind: adapter.kind,
        query: debouncedQuery,
        filters,
        page,
        runtime: requestRuntime,
      });
      if (!mountedRef.current || generation !== searchGenerationRef.current) return;
      setItems((current) => append ? [...current, ...result.items] : [...result.items]);
      setNextPage(result.nextPage);
      setTotal(result.total);
      setSearchStatus('ready');
    } catch (nextError) {
      if (!mountedRef.current || generation !== searchGenerationRef.current) return;
      if (!append) {
        setItems([]);
        setNextPage(null);
        setTotal(undefined);
      }
      setError(nextError);
      setSearchStatus('error');
    }
  }, [adapter, debouncedQuery, filters, runtimeKey]);

  useEffect(() => {
    void executeSearch(0, false);
  }, [executeSearch]);

  const setQuery = useCallback((nextQuery: string) => {
    searchGenerationRef.current += 1;
    setQueryState(nextQuery);
    clearSelection();
    lastMutationRef.current = null;
    setOutcome(null);
    setError(null);
  }, [clearSelection]);

  const setFilter = useCallback((key: string, value: string) => {
    searchGenerationRef.current += 1;
    setFilters((current) => ({ ...current, [key]: value }));
    clearSelection();
    lastMutationRef.current = null;
    setOutcome(null);
    setError(null);
  }, [clearSelection]);

  const toggle = useCallback(async (item: Item, checked: boolean) => {
    const nextGeneration = (selectionGenerationRef.current.get(item.id) ?? 0) + 1;
    selectionGenerationRef.current.set(item.id, nextGeneration);

    if (!checked) {
      const nextChecked = new Set(checkedRef.current);
      nextChecked.delete(item.id);
      publishChecked(nextChecked);
      const nextSelections = new Map(selectionsRef.current);
      nextSelections.delete(item.id);
      publishSelections(nextSelections);
      setResolvingIds((current) => {
        const next = new Set(current);
        next.delete(item.id);
        return next;
      });
      return;
    }

    const nextChecked = new Set(checkedRef.current).add(item.id);
    publishChecked(nextChecked);
    setResolvingIds((current) => new Set(current).add(item.id));
    setError(null);

    try {
      const resolved = await adapter.resolveSelection({ item, filters, runtime: runtimeRef.current });
      if (!mountedRef.current
        || selectionGenerationRef.current.get(item.id) !== nextGeneration
        || !checkedRef.current.has(item.id)) return;
      const nextSelections = new Map(selectionsRef.current).set(item.id, resolved);
      publishSelections(nextSelections);
    } catch (nextError) {
      if (!mountedRef.current || selectionGenerationRef.current.get(item.id) !== nextGeneration) return;
      const withoutFailed = new Set(checkedRef.current);
      withoutFailed.delete(item.id);
      publishChecked(withoutFailed);
      setError(nextError);
    } finally {
      if (mountedRef.current && selectionGenerationRef.current.get(item.id) === nextGeneration) {
        setResolvingIds((current) => {
          const next = new Set(current);
          next.delete(item.id);
          return next;
        });
      }
    }
  }, [adapter, filters, publishChecked, publishSelections]);

  const applyOutcome = useCallback((nextOutcome: AcquisitionOutcome) => {
    setOutcome(
      nextOutcome.didCommit || nextOutcome.retainedSelectionIds.length > 0 || nextOutcome.issues.length > 0
        ? nextOutcome
        : null,
    );
    const retained = new Set(nextOutcome.retainedSelectionIds);
    const nextSelections = new Map(
      [...selectionsRef.current].filter(([id]) => retained.has(id)),
    );
    publishSelections(nextSelections);
    publishChecked(new Set(nextSelections.keys()));
  }, [publishChecked, publishSelections]);

  const install = useCallback(async (requestedSelections: readonly Selection[]) => {
    if (installingRef.current || requestedSelections.length === 0) return null;
    lastMutationRef.current = 'catalog';
    installingRef.current = true;
    setIsInstalling(true);
    setError(null);
    try {
      const nextOutcome = await adapter.install({ selections: requestedSelections, runtime: runtimeRef.current });
      if (!mountedRef.current) return null;
      applyOutcome(nextOutcome);
      return nextOutcome;
    } catch (nextError) {
      if (mountedRef.current) setError(nextError);
      return null;
    } finally {
      installingRef.current = false;
      if (mountedRef.current) setIsInstalling(false);
    }
  }, [adapter, applyOutcome]);

  const installSelected = useCallback(() => {
    const ready = [...checkedRef.current].flatMap((id) => {
      const resolved = selectionsRef.current.get(id);
      return resolved ? [resolved] : [];
    });
    return install(ready);
  }, [install]);

  const loadNextPage = useCallback(async () => {
    if (nextPage === null || searchStatus === 'loading' || searchStatus === 'loading-more') return;
    await executeSearch(nextPage, true);
  }, [executeSearch, nextPage, searchStatus]);

  const retrySearch = useCallback(() => executeSearch(0, false), [executeSearch]);

  const importLocal = useCallback(async () => {
    const localImporter = adapter.importLocal as ((input: {
      runtime: ContentRuntimeInput<K>;
    }) => Promise<AcquisitionOutcome>) | undefined;
    if (!localImporter || importingLocalRef.current) return null;
    lastMutationRef.current = 'local';
    importingLocalRef.current = true;
    setIsImportingLocal(true);
    setError(null);
    try {
      const nextOutcome = await localImporter({ runtime: runtimeRef.current });
      if (!mountedRef.current) return null;
      applyOutcome(nextOutcome);
      return nextOutcome;
    } catch (nextError) {
      if (mountedRef.current) setError(nextError);
      return null;
    } finally {
      importingLocalRef.current = false;
      if (mountedRef.current) setIsImportingLocal(false);
    }
  }, [adapter, applyOutcome]);

  const retryFailed = useCallback(() => (
    lastMutationRef.current === 'local' ? importLocal() : installSelected()
  ), [importLocal, installSelected]);

  const reset = useCallback(() => {
    searchGenerationRef.current += 1;
    setQueryState(initialQuery);
    setDebouncedQuery(initialQuery);
    setFilters({ ...initialFilters });
    setItems([]);
    setNextPage(null);
    setTotal(undefined);
    clearSelection();
    lastMutationRef.current = null;
    setSearchStatus('idle');
    setError(null);
    setOutcome(null);
  }, [clearSelection, initialFilters, initialQuery]);

  return {
    query,
    filters,
    items,
    nextPage,
    total,
    checkedIds,
    resolvingIds,
    selections,
    searchStatus,
    isInstalling,
    isImportingLocal,
    error,
    outcome,
    canImportLocal: Boolean(adapter.importLocal),
    setQuery,
    setFilter,
    toggle,
    loadNextPage,
    installSelected,
    retryFailed,
    retrySearch,
    importLocal,
    reset,
  };
}
