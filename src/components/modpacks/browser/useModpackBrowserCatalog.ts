import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  ProviderCatalogSearchResultItem,
  ProviderCatalogVersionDescriptor,
} from '@shared/contracts';
import { useDebounce } from '../../../hooks/useDebounce';
import { providerCatalogIPC } from '../../../services/ipc/providerCatalogIPC';
import {
  DEFAULT_MODPACK_BROWSER_STATE,
  normalizeModpackBrowserState,
  type ModpackBrowserState,
} from '../../../features/modpacks/hooks/useModpackNavigation';

const FAVORITES_STORAGE_KEY = 'modpack-favorites';
const HISTORY_STORAGE_KEY = 'modpack-history';
const ITEMS_PER_PAGE_STORAGE_KEY = 'modpack-items-per-page';
const ITEMS_PER_PAGE_OPTIONS = [12, 24, 48] as const;
const MAX_QUERY_LENGTH = 200;

type CatalogIdentity = Pick<ProviderCatalogSearchResultItem, 'projectId' | 'platform'>;

export interface UseModpackBrowserCatalogParams {
  initialState: ModpackBrowserState;
  onStateChange: (state: ModpackBrowserState) => void;
  onNavigate: (view: {
    type: 'install';
    modpack: ProviderCatalogSearchResultItem;
    versions: ProviderCatalogVersionDescriptor[];
    platform: 'curseforge' | 'modrinth';
  }) => void;
}

function identityOf(modpack: CatalogIdentity): string {
  return `${modpack.platform}:${modpack.projectId}`;
}

function safeStorageRead(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch (error) {
    console.error(`Error reading ${key}:`, error);
    return null;
  }
}

function safeStorageWrite(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    console.error(`Error writing ${key}:`, error);
  }
}

function safeStorageRemove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.error(`Error removing ${key}:`, error);
  }
}

function readFavorites(): Set<string> {
  const raw = safeStorageRead(FAVORITES_STORAGE_KEY);
  if (!raw) return new Set();
  try {
    const parsed: unknown = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : []);
  } catch (error) {
    console.error('Error loading favorites:', error);
    return new Set();
  }
}

function isCatalogHistoryItem(value: unknown): value is ProviderCatalogSearchResultItem {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ProviderCatalogSearchResultItem>;
  return (candidate.platform === 'modrinth' || candidate.platform === 'curseforge')
    && typeof candidate.projectId === 'string'
    && candidate.projectId.length > 0
    && typeof candidate.title === 'string'
    && candidate.title.length > 0;
}

function readHistory(): ProviderCatalogSearchResultItem[] {
  const raw = safeStorageRead(HISTORY_STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isCatalogHistoryItem).slice(0, 50) : [];
  } catch (error) {
    console.error('Error loading history:', error);
    return [];
  }
}

function resolveItemsPerPage(initialValue: number): number {
  const normalizedInitial = ITEMS_PER_PAGE_OPTIONS.includes(initialValue as (typeof ITEMS_PER_PAGE_OPTIONS)[number])
    ? initialValue
    : DEFAULT_MODPACK_BROWSER_STATE.itemsPerPage;
  if (normalizedInitial !== DEFAULT_MODPACK_BROWSER_STATE.itemsPerPage) return normalizedInitial;

  const saved = Number(safeStorageRead(ITEMS_PER_PAGE_STORAGE_KEY));
  return ITEMS_PER_PAGE_OPTIONS.includes(saved as (typeof ITEMS_PER_PAGE_OPTIONS)[number])
    ? saved
    : normalizedInitial;
}

function cloneVersion(version: ProviderCatalogVersionDescriptor): ProviderCatalogVersionDescriptor {
  return {
    ...version,
    mcVersions: [...version.mcVersions],
    loaders: [...version.loaders],
    files: version.files.map((file) => ({ ...file })),
  };
}

export function useModpackBrowserCatalog({
  initialState,
  onStateChange,
  onNavigate,
}: UseModpackBrowserCatalogParams) {
  const [normalizedInitialState] = useState(() => normalizeModpackBrowserState(initialState));
  const [platform] = useState(normalizedInitialState.platform);
  const [query, setQueryState] = useState(() => normalizedInitialState.query.slice(0, MAX_QUERY_LENGTH));
  const [sortBy, setSortByState] = useState(normalizedInitialState.sortBy);
  const [filterMCVersion, setFilterMCVersionState] = useState(normalizedInitialState.filterMCVersion);
  const [filterLoader, setFilterLoaderState] = useState(normalizedInitialState.filterLoader);
  const [currentPage, setCurrentPage] = useState(() => Math.max(1, Math.floor(normalizedInitialState.currentPage)));
  const [itemsPerPage, setItemsPerPageState] = useState(() => resolveItemsPerPage(normalizedInitialState.itemsPerPage));
  const [showHistory, setShowHistory] = useState(normalizedInitialState.showHistory);
  const [results, setResults] = useState<ProviderCatalogSearchResultItem[]>([]);
  const [totalResults, setTotalResults] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState<unknown | null>(null);
  const [favorites, setFavorites] = useState(readFavorites);
  const [history, setHistory] = useState(readHistory);
  const [openingIdentity, setOpeningIdentity] = useState<string | null>(null);
  const searchGenerationRef = useRef(0);
  const openingIdentityRef = useRef<string | null>(null);
  const debouncedQuery = useDebounce(query, 500);

  const browserState = useMemo<ModpackBrowserState>(() => ({
    platform,
    query,
    sortBy,
    filterMCVersion,
    filterLoader,
    currentPage,
    itemsPerPage,
    showHistory,
  }), [currentPage, filterLoader, filterMCVersion, itemsPerPage, platform, query, showHistory, sortBy]);

  useEffect(() => onStateChange(browserState), [browserState, onStateChange]);
  useEffect(() => {
    safeStorageWrite(ITEMS_PER_PAGE_STORAGE_KEY, String(itemsPerPage));
  }, [itemsPerPage]);

  const search = useCallback(async () => {
    const generation = ++searchGenerationRef.current;
    setLoading(true);
    setSearchError(null);
    try {
      const response = await providerCatalogIPC.search({
        platform,
        query: debouncedQuery.trim().slice(0, MAX_QUERY_LENGTH),
        ...(filterMCVersion === 'all' ? {} : { minecraftVersion: filterMCVersion }),
        ...(filterLoader === 'all' ? {} : { loader: filterLoader }),
        sort: sortBy,
        offset: (currentPage - 1) * itemsPerPage,
        limit: itemsPerPage,
      });
      if (generation !== searchGenerationRef.current) return;
      const nextResults = [...response.items];
      setResults(nextResults);
      setTotalResults(response.total || nextResults.length);
    } catch (error) {
      if (generation !== searchGenerationRef.current) return;
      console.error('Error searching modpacks:', error);
      setSearchError(error);
      setResults([]);
      setTotalResults(0);
    } finally {
      if (generation === searchGenerationRef.current) setLoading(false);
    }
  }, [currentPage, debouncedQuery, filterLoader, filterMCVersion, itemsPerPage, platform, sortBy]);

  useEffect(() => {
    if (showHistory) {
      searchGenerationRef.current += 1;
      setLoading(false);
      return;
    }
    void search();
    return () => {
      searchGenerationRef.current += 1;
    };
  }, [search, showHistory]);

  const setQuery = useCallback((value: string) => {
    setQueryState(value.slice(0, MAX_QUERY_LENGTH));
    setCurrentPage(1);
  }, []);
  const setSortBy = useCallback((value: ModpackBrowserState['sortBy']) => {
    setSortByState(value);
    setCurrentPage(1);
  }, []);
  const setFilterMCVersion = useCallback((value: ModpackBrowserState['filterMCVersion']) => {
    setFilterMCVersionState(value);
    setCurrentPage(1);
  }, []);
  const setFilterLoader = useCallback((value: ModpackBrowserState['filterLoader']) => {
    setFilterLoaderState(value);
    setCurrentPage(1);
  }, []);
  const setItemsPerPage = useCallback((value: number) => {
    if (!ITEMS_PER_PAGE_OPTIONS.includes(value as (typeof ITEMS_PER_PAGE_OPTIONS)[number])) return;
    setItemsPerPageState(value);
    setCurrentPage(1);
  }, []);
  const resetFilters = useCallback(() => {
    setQueryState(DEFAULT_MODPACK_BROWSER_STATE.query);
    setSortByState(DEFAULT_MODPACK_BROWSER_STATE.sortBy);
    setFilterMCVersionState(DEFAULT_MODPACK_BROWSER_STATE.filterMCVersion);
    setFilterLoaderState(DEFAULT_MODPACK_BROWSER_STATE.filterLoader);
    setCurrentPage(1);
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    safeStorageRemove(HISTORY_STORAGE_KEY);
  }, []);
  const addToHistory = useCallback((modpack: ProviderCatalogSearchResultItem) => {
    setHistory((current) => {
      const next = [
        modpack,
        ...current.filter((candidate) => identityOf(candidate) !== identityOf(modpack)),
      ].slice(0, 50);
      safeStorageWrite(HISTORY_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const isFavorite = useCallback((modpack: CatalogIdentity) => {
    return favorites.has(identityOf(modpack)) || favorites.has(modpack.projectId);
  }, [favorites]);
  const toggleFavorite = useCallback((modpack: CatalogIdentity) => {
    setFavorites((current) => {
      const next = new Set(current);
      const identity = identityOf(modpack);
      if (next.has(identity) || next.has(modpack.projectId)) {
        next.delete(identity);
        next.delete(modpack.projectId);
      } else {
        next.delete(modpack.projectId);
        next.add(identity);
      }
      safeStorageWrite(FAVORITES_STORAGE_KEY, JSON.stringify([...next]));
      return next;
    });
  }, []);

  const openModpack = useCallback(async (modpack: ProviderCatalogSearchResultItem) => {
    const identity = identityOf(modpack);
    if (openingIdentityRef.current) return;
    openingIdentityRef.current = identity;
    setOpeningIdentity(identity);
    addToHistory(modpack);
    try {
      const versions = (await providerCatalogIPC.versions({
        platform: modpack.platform,
        projectId: modpack.projectId,
      })).map(cloneVersion);
      onNavigate({ type: 'install', modpack, versions, platform: modpack.platform });
    } catch (error) {
      console.error('Error loading versions:', error);
    } finally {
      openingIdentityRef.current = null;
      setOpeningIdentity(null);
    }
  }, [addToHistory, onNavigate]);

  const totalPages = Math.ceil(totalResults / itemsPerPage);

  return {
    browserState,
    query,
    setQuery,
    sortBy,
    setSortBy,
    filterMCVersion,
    setFilterMCVersion,
    filterLoader,
    setFilterLoader,
    currentPage,
    setCurrentPage,
    itemsPerPage,
    setItemsPerPage,
    showHistory,
    setShowHistory,
    results,
    totalResults,
    totalPages,
    loading,
    searchError,
    retrySearch: search,
    history,
    recentHistory: history.slice(0, 3),
    clearHistory,
    isFavorite,
    toggleFavorite,
    openModpack,
    openingIdentity,
    resetFilters,
    hasSearchFilters: Boolean(
      query.trim()
      || filterMCVersion !== DEFAULT_MODPACK_BROWSER_STATE.filterMCVersion
      || filterLoader !== DEFAULT_MODPACK_BROWSER_STATE.filterLoader
    ),
    hasActiveFilters: Boolean(
      query.trim()
      || filterMCVersion !== DEFAULT_MODPACK_BROWSER_STATE.filterMCVersion
      || filterLoader !== DEFAULT_MODPACK_BROWSER_STATE.filterLoader
      || sortBy !== DEFAULT_MODPACK_BROWSER_STATE.sortBy
    ),
  };
}
