import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSettings } from '../../contexts/SettingsContext';
import type { ModLoaderType } from '../../contexts/instances/types';
import { useDebounce } from '../../hooks/useDebounce';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { cn } from '../../utils/cn';
import type { ModpackSearchResultItem, ModpackVersionDescriptor } from '@shared/contracts';
import { Button } from '../ui/Button';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { LazyImage } from '../ui/LazyImage';
import { modpacksIPC } from '../../services/ipc/modpacksIPC';
import { dialogIPC } from '../../services/ipc/dialogIPC';
import { MINECRAFT_VERSIONS } from '../../utils/minecraftVersionsList';
import { DEFAULT_MODPACK_BROWSER_STATE, normalizeModpackBrowserState, type ModpackBrowserState } from '../../features/modpacks/hooks/useModpackNavigation';
import { ArrowLeft, History, Import, Star } from 'lucide-react';
import { DegradedStateView } from '../layout/DegradedStateView';
import { toDisplayErrorMessage } from '../../utils/displayError';
import { ModpackCatalogControls } from './ModpackCatalogControls';
import { getModloaderDisplayLabel } from '../sidebar/modpackRuntimeDependencies';

type Platform = ModpackBrowserState['platform'];
type SortOption = ModpackBrowserState['sortBy'];
type FilterMCVersion = ModpackBrowserState['filterMCVersion'];
type FilterLoader = ModpackBrowserState['filterLoader'];

function isActivationKey(key: string) {
  return key === 'Enter' || key === ' ';
}

interface ModpackBrowserProps {
  initialState: ModpackBrowserState;
  onBack: () => void;
  onNavigate: (
    view:
      | { type: 'install'; modpack: ModpackSearchResultItem; versions: ModpackVersionDescriptor[]; platform: 'curseforge' | 'modrinth' }
      | { type: 'importPreview'; filePath: string }
  ) => void;
  onStateChange: (state: ModpackBrowserState) => void;
}

const MODPACK_FAVORITES_STORAGE_KEY = 'modpack-favorites';
const MODPACK_HISTORY_STORAGE_KEY = 'modpack-history';

function getModpackIdentity(modpack: Pick<ModpackSearchResultItem, 'projectId' | 'platform'>): string {
  return `${modpack.platform}:${modpack.projectId}`;
}

function translateWithFallback(
  t: (key: string, params?: Record<string, string | number>) => string,
  key: string,
  fallback: string,
  params?: Record<string, string | number>,
): string {
  const value = t(key, params);
  return value === key ? fallback : value;
}

function formatDateLabel(
  value: string | undefined,
  formatDate: (timestamp: number | undefined, unknownText?: string, options?: Intl.DateTimeFormatOptions) => string,
): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return formatDate(date.getTime(), '', { dateStyle: 'medium' }) || null;
}

function formatLoaderLabel(
  t: (key: string, params?: Record<string, string | number>) => string,
  loader: string,
): string {
  if (!loader) {
    return loader;
  }

  return getModloaderDisplayLabel({ type: loader.toLowerCase() as ModLoaderType }, t);
}

function resolveResultMinecraftVersion(modpack: ModpackSearchResultItem, activeFilter: FilterMCVersion): string | null {
  const explicitVersion = modpack.minecraftVersion?.trim();
  if (explicitVersion) {
    return explicitVersion;
  }

  return activeFilter !== DEFAULT_MODPACK_BROWSER_STATE.filterMCVersion
    ? activeFilter
    : null;
}

export const ModpackBrowser: React.FC<ModpackBrowserProps> = ({ initialState, onBack, onNavigate, onStateChange }) => {
  const { t, getAccentStyles, formatDate, formatNumber } = useSettings();
  const normalizedInitialState = normalizeModpackBrowserState(initialState);
  const [platform] = useState<Platform>(normalizedInitialState.platform);
  const [query, setQuery] = useState(normalizedInitialState.query);
  const [searchResults, setSearchResults] = useState<ModpackSearchResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [, setSelectedModpack] = useState<ModpackSearchResultItem | null>(null);
  const [, setVersions] = useState<ModpackVersionDescriptor[]>([]);
  const [sortBy, setSortBy] = useState<SortOption>(normalizedInitialState.sortBy);
  const [filterMCVersion, setFilterMCVersion] = useState<FilterMCVersion>(normalizedInitialState.filterMCVersion);
  const [filterLoader, setFilterLoader] = useState<FilterLoader>(normalizedInitialState.filterLoader);
  const [currentPage, setCurrentPage] = useState(normalizedInitialState.currentPage);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [totalResults, setTotalResults] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(() => {
    const saved = localStorage.getItem('modpack-items-per-page');
    if (!saved) {
      return normalizedInitialState.itemsPerPage;
    }

    if (normalizedInitialState.itemsPerPage !== DEFAULT_MODPACK_BROWSER_STATE.itemsPerPage) {
      return normalizedInitialState.itemsPerPage;
    }

    const parsed = Number(saved);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : normalizedInitialState.itemsPerPage;
  });
  const [showHistory, setShowHistory] = useState(normalizedInitialState.showHistory);
  const [history, setHistory] = useState<ModpackSearchResultItem[]>([]);
  const [searchError, setSearchError] = useState<unknown | null>(null);
  const didHydratePageResetRef = useRef(false);

  const browserState = useMemo<ModpackBrowserState>(() => ({
    platform,
    query,
    sortBy,
    filterMCVersion,
    filterLoader,
    currentPage,
    itemsPerPage,
    showHistory,
  }), [platform, query, sortBy, filterMCVersion, filterLoader, currentPage, itemsPerPage, showHistory]);

  useEffect(() => {
    onStateChange(browserState);
  }, [browserState, onStateChange]);

  // Load favorites from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(MODPACK_FAVORITES_STORAGE_KEY);
    if (saved) {
      try {
        setFavorites(new Set(JSON.parse(saved)));
      } catch (e) {
        console.error('Error loading favorites:', e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('modpack-items-per-page', String(itemsPerPage));
  }, [itemsPerPage]);

  // Load history
  useEffect(() => {
    try {
      const savedHistory = localStorage.getItem(MODPACK_HISTORY_STORAGE_KEY);
      if (savedHistory) {
        setHistory(JSON.parse(savedHistory));
      }
    } catch (e) {
      console.error('Error loading history:', e);
    }
  }, []);

  const addToHistory = useCallback((modpack: ModpackSearchResultItem) => {
    setHistory(prev => {
      const filtered = prev.filter((candidate) => getModpackIdentity(candidate) !== getModpackIdentity(modpack));
      const newHistory = [modpack, ...filtered].slice(0, 50);
      localStorage.setItem(MODPACK_HISTORY_STORAGE_KEY, JSON.stringify(newHistory));
      return newHistory;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    localStorage.removeItem(MODPACK_HISTORY_STORAGE_KEY);
  }, []);

  const handleItemsPerPageChange = (val: number) => {
    setItemsPerPage(val);
    setCurrentPage(1);
  };

  const handleResetFilters = useCallback(() => {
    setQuery(DEFAULT_MODPACK_BROWSER_STATE.query);
    setSortBy(DEFAULT_MODPACK_BROWSER_STATE.sortBy);
    setFilterMCVersion(DEFAULT_MODPACK_BROWSER_STATE.filterMCVersion);
    setFilterLoader(DEFAULT_MODPACK_BROWSER_STATE.filterLoader);
    setCurrentPage(1);
  }, []);

  // Save favorites to localStorage
  const saveFavorites = useCallback((newFavorites: Set<string>) => {
    setFavorites(newFavorites);
    localStorage.setItem(MODPACK_FAVORITES_STORAGE_KEY, JSON.stringify(Array.from(newFavorites)));
  }, []);

  const isFavorite = useCallback((modpack: Pick<ModpackSearchResultItem, 'projectId' | 'platform'>) => {
    const identity = getModpackIdentity(modpack);
    return favorites.has(identity) || favorites.has(modpack.projectId);
  }, [favorites]);

  const toggleFavorite = useCallback((modpack: Pick<ModpackSearchResultItem, 'projectId' | 'platform'>) => {
    const newFavorites = new Set(favorites);
    const identity = getModpackIdentity(modpack);

    if (newFavorites.has(identity) || newFavorites.has(modpack.projectId)) {
      newFavorites.delete(identity);
      newFavorites.delete(modpack.projectId);
    } else {
      newFavorites.delete(modpack.projectId);
      newFavorites.add(identity);
    }

    saveFavorites(newFavorites);
  }, [favorites, saveFavorites]);

  const debouncedQuery = useDebounce(query, 500);

  const searchModpacks = useCallback(async () => {
    setLoading(true);
    setSearchError(null);
    try {
      // Используем пустую строку для получения популярных модпаков, если запрос пустой
      const searchQuery = debouncedQuery.trim() || '';

      // Вычисляем offset для текущей страницы
      const offset = (currentPage - 1) * itemsPerPage;

      // Подготавливаем параметры
      const mcVersion = filterMCVersion !== 'all' ? filterMCVersion : undefined;
      const loader = filterLoader !== 'all' ? filterLoader : undefined;

      let results;
      if (platform === 'curseforge') {
        results = await modpacksIPC.searchCurseForge(
          searchQuery,
          mcVersion,
          loader,
          sortBy,
          offset,
          itemsPerPage
        );
      } else {
        results = await modpacksIPC.searchModrinth(
          searchQuery,
          mcVersion,
          loader,
          sortBy,
          offset,
          itemsPerPage
        );
      }

      const items = results.items || [];
      setSearchResults(items);
      setTotalResults(results.total || items.length);
    } catch (error) {
      console.error('Error searching modpacks:', error);
      setSearchError(error);
      setSearchResults([]);
      setTotalResults(0);
    } finally {
      setLoading(false);
    }
  }, [debouncedQuery, platform, filterMCVersion, filterLoader, sortBy, currentPage, itemsPerPage]);

  useEffect(() => {
    // Сбрасываем на первую страницу при изменении фильтров
    if (!didHydratePageResetRef.current) {
      didHydratePageResetRef.current = true;
      return;
    }

    setCurrentPage(1);
  }, [debouncedQuery, platform, filterMCVersion, filterLoader, sortBy]);

  useEffect(() => {
    // Выполняем поиск при изменении debouncedQuery или других параметров
    searchModpacks();
  }, [debouncedQuery, platform, filterMCVersion, filterLoader, sortBy, currentPage, searchModpacks]);

  const handleModpackClick = useCallback(async (modpack: ModpackSearchResultItem) => {
    addToHistory(modpack);
    setSelectedModpack(modpack);
    setLoading(true);
    try {
      let versionsList: ModpackVersionDescriptor[];
      const modpackPlatform = modpack.platform;

      if (modpackPlatform === 'curseforge') {
        versionsList = await modpacksIPC.getCurseForgeVersions(Number(modpack.projectId));
      } else {
        versionsList = await modpacksIPC.getModrinthVersions(modpack.projectId);
      }

      setVersions(versionsList);
      onNavigate({ type: 'install', modpack, versions: versionsList, platform: modpackPlatform });
    } catch (error) {
      console.error('Error loading versions:', error);
    } finally {
      setLoading(false);
    }
  }, [addToHistory, onNavigate]);

  // Results are already sorted and filtered by the API
  // Pagination is handled by the API as well
  const totalPages = Math.ceil(totalResults / itemsPerPage);
  const paginatedResults = searchResults;
  const hasSearchFilters =
    query.trim().length > 0
    || filterMCVersion !== DEFAULT_MODPACK_BROWSER_STATE.filterMCVersion
    || filterLoader !== DEFAULT_MODPACK_BROWSER_STATE.filterLoader;
  const hasActiveFilters =
    hasSearchFilters
    || sortBy !== DEFAULT_MODPACK_BROWSER_STATE.sortBy;
  const showingStart = totalResults > 0 ? ((currentPage - 1) * itemsPerPage) + 1 : 0;
  const showingEnd = totalResults > 0 ? showingStart + paginatedResults.length - 1 : 0;
  const formattedShowingStart = formatNumber(showingStart);
  const formattedShowingEnd = formatNumber(showingEnd);
  const formattedTotalResults = formatNumber(totalResults);
  const formattedCurrentPage = formatNumber(currentPage);
  const formattedTotalPages = formatNumber(Math.max(totalPages, 1));
  const recentHistory = useMemo(() => history.slice(0, 3), [history]);
  const remoteCatalogStatus = useMemo(() => {
    if (searchError) {
      return [t('degraded.error_label')];
    }

    const items = [
      totalResults > 0
        ? translateWithFallback(
            t,
            'modpacks.results_summary',
            `Showing ${formattedShowingStart}-${formattedShowingEnd} of ${formattedTotalResults}`,
            { start: formattedShowingStart, end: formattedShowingEnd, total: formattedTotalResults },
          )
        : translateWithFallback(t, 'modpacks.results_summary_empty', 'No results yet'),
    ];

    if (totalPages > 1) {
      items.push(
        translateWithFallback(
          t,
          'modpacks.results_page_summary',
          `Page ${formattedCurrentPage} of ${formattedTotalPages}`,
          { current: formattedCurrentPage, total: formattedTotalPages },
        ),
      );
    }

    if (recentHistory.length > 0) {
      items.push(
        `${translateWithFallback(t, 'modpacks.recently_viewed', 'Recently viewed')}: ${formatNumber(recentHistory.length)}`,
      );
    }

    return items;
  }, [
    formattedCurrentPage,
    formattedShowingEnd,
    formattedShowingStart,
    formattedTotalPages,
    formattedTotalResults,
    formatNumber,
    recentHistory.length,
    searchError,
    t,
    totalPages,
    totalResults,
  ]);
  const browserErrorTitle = t('error.inline_fallback');
  const browserErrorDescription = searchError
    ? (() => {
      const detail = toDisplayErrorMessage(searchError, browserErrorTitle);
      return detail !== browserErrorTitle ? detail : t('modpacks.browser_desc');
    })()
    : '';
  const activeFilterTokens = useMemo(() => {
    const tokens: string[] = [];

    if (query.trim().length > 0) {
      tokens.push(`${translateWithFallback(t, 'modpacks.search', 'Search modpacks')}: "${query.trim()}"`);
    }
    if (filterMCVersion !== DEFAULT_MODPACK_BROWSER_STATE.filterMCVersion) {
      tokens.push(`${translateWithFallback(t, 'modpacks.minecraft_version', 'Minecraft Version')}: ${filterMCVersion}`);
    }
    if (filterLoader !== DEFAULT_MODPACK_BROWSER_STATE.filterLoader) {
      tokens.push(`${translateWithFallback(t, 'modpacks.loader', 'Modloader')}: ${formatLoaderLabel(t, filterLoader)}`);
    }
    if (sortBy !== DEFAULT_MODPACK_BROWSER_STATE.sortBy) {
      tokens.push(
        sortBy === 'alphabetical'
          ? translateWithFallback(t, 'modpacks.sort_alphabetical', 'Alphabetical')
          : sortBy === 'date'
            ? translateWithFallback(t, 'modpacks.sort_date', 'Date')
            : translateWithFallback(t, 'modpacks.sort_popularity', 'Popularity')
      );
    }

    return tokens;
  }, [filterLoader, filterMCVersion, query, sortBy, t]);

  const handleImport = async () => {
    try {
      const result = await dialogIPC.showOpenDialog({
        title: t('modpacks.select_modpack_file') || 'Выберите файл модпака',
        filters: [
          { name: 'Modpack Files', extensions: ['mrpack', 'zip', 'curseforge'] },
          { name: 'All Files', extensions: ['*'] },
        ],
        properties: ['openFile'],
      });

      if (result && !result.canceled && result.filePaths.length > 0) {
        onNavigate({ type: 'importPreview', filePath: result.filePaths[0] });
      }
    } catch (err) {
      console.error('Error opening file dialog:', err);
    }
  };

  const handleCardKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>, modpack: ModpackSearchResultItem) => {
    if (!isActivationKey(event.key)) {
      return;
    }

    event.preventDefault();
    void handleModpackClick(modpack);
  }, [handleModpackClick]);

  const renderModpackCard = useCallback((modpack: ModpackSearchResultItem) => {
    const isFavorited = isFavorite(modpack);
    const providerLabel = modpack.platform === 'curseforge'
      ? translateWithFallback(t, 'modpacks.platform_curseforge', 'CurseForge')
      : translateWithFallback(t, 'modpacks.platform_modrinth', 'Modrinth');
    const minecraftVersion = resolveResultMinecraftVersion(modpack, filterMCVersion);
    const updatedLabel = formatDateLabel(modpack.dateModified ?? modpack.dateCreated, formatDate);
    const favoritesActionLabel = isFavorited
      ? translateWithFallback(t, 'modpacks.remove_favorite', 'Remove favorite')
      : translateWithFallback(t, 'modpacks.add_favorite', 'Add favorite');
    const activeFavoriteBackground = getAccentStyles('soft-bg');
    const activeFavoriteBorder = getAccentStyles('soft-border');
    const activeFavoriteLabel = getAccentStyles('title');

    return (
      <div
        key={getModpackIdentity(modpack)}
        role="listitem"
        onClick={() => {
          void handleModpackClick(modpack);
        }}
        className="surface-card relative flex min-h-[17rem] cursor-pointer flex-col p-4 transition-colors hover:border-border-active hover:bg-card focus-within:ring-2 focus-within:ring-[rgb(var(--accent-main))] focus-within:ring-offset-2 focus-within:ring-offset-background"
      >
        <div
          role="button"
          tabIndex={0}
          aria-label={modpack.title}
          onClick={(event) => {
            event.stopPropagation();
            void handleModpackClick(modpack);
          }}
          onKeyDown={(event) => {
            void handleCardKeyDown(event, modpack);
          }}
          className="absolute inset-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-[rgb(var(--accent-main))] focus:ring-offset-2 focus:ring-offset-background"
        />
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            toggleFavorite(modpack);
          }}
          aria-pressed={isFavorited}
          aria-label={`${favoritesActionLabel}: ${modpack.title}`}
          data-state={isFavorited ? 'active' : 'inactive'}
          className={cn(
            'absolute top-2 right-2 rounded-full border p-1.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--accent-main))] focus-visible:ring-offset-2 focus-visible:ring-offset-background',
            isFavorited
              ? cn(
                'border-border/60 bg-card/90',
                activeFavoriteBackground.className,
                activeFavoriteBorder.className,
              )
              : 'border-transparent hover:bg-background/70'
          )}
          style={isFavorited ? {
            ...activeFavoriteBackground.style,
            ...activeFavoriteBorder.style,
          } : undefined}
          title={favoritesActionLabel}
        >
          <Star
            className={cn(
              'h-5 w-5',
              isFavorited
                ? cn('fill-current', activeFavoriteLabel.className)
                : 'text-muted'
            )}
            style={isFavorited ? activeFavoriteLabel.style : undefined}
          />
        </button>
        <div className="flex h-full flex-col gap-4">
          <div className="flex gap-4">
            <LazyImage
              src={modpack.iconUrl ?? undefined}
              alt={modpack.title}
              className="h-16 w-16 rounded-2xl border border-border/70 object-cover"
            />
            <div className="min-w-0 flex-1">
              <div className="mb-2 flex flex-wrap items-center gap-2 pr-8">
                <span className={cn(
                  'rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.12em]',
                  modpack.platform === 'curseforge'
                    ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                    : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                )}>
                  {providerLabel}
                </span>
              </div>
              <h4 className="truncate font-semibold text-foreground">
                {modpack.title}
              </h4>
            </div>
          </div>

          {(minecraftVersion || updatedLabel) && (
            <div className="grid gap-2 text-xs text-secondary sm:grid-cols-2">
              {minecraftVersion && (
                <div className="rounded-2xl border border-border/70 bg-background/72 px-3 py-2">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                    {translateWithFallback(t, 'modpacks.minecraft_version', 'Minecraft Version')}
                  </div>
                  <div className="mt-1 text-sm font-medium text-foreground">
                    {minecraftVersion}
                  </div>
                </div>
              )}
              {updatedLabel && (
                <div className="rounded-2xl border border-border/70 bg-background/72 px-3 py-2">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                    {translateWithFallback(t, 'modpacks.updated', 'Updated')}
                  </div>
                  <div className="mt-1 text-sm font-medium text-foreground">
                    {updatedLabel}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="relative z-10 mt-auto pt-1" onClick={(event) => event.stopPropagation()}>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                void handleModpackClick(modpack);
              }}
              className={cn('w-full justify-center', getAccentStyles('bg').className)}
              style={getAccentStyles('bg').style}
              aria-label={`${translateWithFallback(t, 'modpacks.open_details', 'Open details')}: ${modpack.title}`}
            >
              {translateWithFallback(t, 'modpacks.open_details', 'Open details')}
            </Button>
          </div>
        </div>
      </div>
    );
  }, [filterMCVersion, formatDate, getAccentStyles, handleCardKeyDown, handleModpackClick, isFavorite, t, toggleFavorite]);


  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header with back button, title, platform tabs, import */}
      <div className="border-b border-border/70 bg-card/78 px-6 py-4 backdrop-blur-md">
        <div className="flex min-w-0 flex-wrap items-center gap-4">
        <Button
          variant="secondary"
          size="sm"
          onClick={onBack}
          className="flex items-center gap-2 shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('general.back') || 'Назад'}
        </Button>
        <div className="min-w-0 flex-1">
          <div className="kicker-label">{t('modpacks.browser')}</div>
          <h2 className="text-xl font-bold text-foreground shrink-0">
            {t('modpacks.browser')}
          </h2>
          <p className="mt-1 text-sm text-secondary">
            {translateWithFallback(
              t,
              'modpacks.browser_desc',
              'Browse remote packs, reopen recent installs, or import an archive directly.'
            )}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-3">
          <div className="min-w-0 rounded-2xl border border-border/70 bg-background/72 px-4 py-3 text-right">
            <div className="flex flex-wrap items-center justify-end gap-2">
              <span
                className={cn(
                  'rounded-full px-3 py-1 text-xs font-semibold text-white',
                  getAccentStyles('bg').className
                )}
                style={getAccentStyles('bg').style}
              >
                {translateWithFallback(t, 'modpacks.platform_modrinth', 'Modrinth')}
              </span>
              <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-300">
                {translateWithFallback(t, 'modpacks.provider_curseforge_unavailable', 'CurseForge browse unavailable')}
              </span>
            </div>
            <p className="mt-2 text-xs text-secondary">
              {translateWithFallback(
                t,
                'modpacks.provider_curseforge_hint',
                'CurseForge installs can still enter through imported archives or shared codes.'
              )}
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleImport}
            className="shrink-0 ml-2"
          >
            <Import className="h-4 w-4" />
            {t('modpacks.import') || 'Импорт'}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowHistory(!showHistory)}
            aria-pressed={showHistory}
            data-state={showHistory ? 'active' : 'inactive'}
            className={cn(
              'shrink-0 ml-2',
              showHistory
                ? cn(
                  'border-border bg-card/90 text-foreground',
                  getAccentStyles('soft-bg').className,
                  getAccentStyles('soft-border').className,
                  getAccentStyles('title').className,
                )
                : undefined
            )}
            style={showHistory ? {
              ...getAccentStyles('soft-bg').style,
              ...getAccentStyles('soft-border').style,
              ...getAccentStyles('title').style,
            } : undefined}
            title={t('modpacks.history_tooltip') || 'История просмотров'}
          >
            <History className="h-4 w-4" />
            {t('modpacks.history') || 'История'}
          </Button>
        </div>
      </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 min-h-0 custom-scrollbar">
        {!showHistory && (
          <ModpackCatalogControls
            rootTestId="remote-modpack-filters"
            controlsTestId="remote-modpack-filter-controls"
            searchLabel={t('modpacks.search') || 'Search modpacks'}
            searchControl={(
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('modpacks.search_placeholder')}
                aria-label={t('modpacks.search_placeholder') || 'Search modpacks'}
                className="w-full"
                data-testid="remote-modpack-search"
              />
            )}
            controls={[
              {
                key: 'sort',
                label:
                  sortBy === 'alphabetical'
                    ? translateWithFallback(t, 'modpacks.sort_alphabetical', 'Alphabetical')
                    : sortBy === 'date'
                      ? translateWithFallback(t, 'modpacks.sort_date', 'Date')
                      : translateWithFallback(t, 'modpacks.sort_popularity', 'Popularity'),
                control: (
                  <Select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortOption)}
                    aria-label={t('modpacks.sort_popularity') || 'Sort modpacks'}
                    className="w-full"
                    data-testid="remote-modpack-sort"
                  >
                    <option value="popularity">{t('modpacks.sort_popularity') || 'По популярности'}</option>
                    <option value="alphabetical">{t('modpacks.sort_alphabetical') || 'По алфавиту'}</option>
                    <option value="date">{t('modpacks.sort_date') || 'По дате'}</option>
                  </Select>
                ),
              },
              {
                key: 'version',
                label: translateWithFallback(t, 'modpacks.minecraft_version', 'Minecraft Version'),
                control: (
                  <Select
                    value={filterMCVersion}
                    onChange={(e) => setFilterMCVersion(e.target.value as FilterMCVersion)}
                    aria-label={t('modpacks.filter_all') || 'Filter by Minecraft version'}
                    className="w-full"
                    data-testid="remote-modpack-version-filter"
                  >
                    <option value="all">{t('modpacks.filter_all') || 'Все версии MC'}</option>
                    {MINECRAFT_VERSIONS.filter((v) => v.type === 'release').map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.id}
                      </option>
                    ))}
                  </Select>
                ),
              },
              {
                key: 'loader',
                label: translateWithFallback(t, 'modpacks.loader', 'Modloader'),
                control: (
                  <Select
                    value={filterLoader}
                    onChange={(e) => setFilterLoader(e.target.value as FilterLoader)}
                    aria-label={t('modpacks.filter_all_loaders') || 'Filter by modloader'}
                    className="w-full"
                    data-testid="remote-modpack-loader-filter"
                  >
                    <option value="all">{t('modpacks.filter_all_loaders') || 'Все модлоадеры'}</option>
                    <option value="forge">Forge</option>
                    <option value="fabric">Fabric</option>
                    <option value="neoforge">NeoForge</option>
                  </Select>
                ),
              },
              {
                key: 'items-per-page',
                label: translateWithFallback(t, 'modpacks.items_per_page', 'Items per page'),
                control: (
                  <Select
                    value={String(itemsPerPage)}
                    onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
                    aria-label={t('modpacks.items_per_page') || 'Items per page'}
                    className="w-full"
                    title={t('modpacks.items_per_page') || 'Элементов на странице'}
                    data-testid="remote-modpack-items-per-page"
                  >
                    <option value="12">12</option>
                    <option value="24">24</option>
                    <option value="48">48</option>
                  </Select>
                ),
              },
            ]}
            activeFilterTokens={activeFilterTokens}
            onReset={hasActiveFilters ? handleResetFilters : undefined}
            resetLabel={translateWithFallback(t, 'modpacks.clear_filters', 'Clear filters')}
            status={remoteCatalogStatus.map((item) => (
              <span key={item}>{item}</span>
            ))}
            footer={recentHistory.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {recentHistory.map((modpack) => (
                  <button
                    key={getModpackIdentity(modpack)}
                    type="button"
                    onClick={() => {
                      void handleModpackClick(modpack);
                    }}
                    className="inline-flex min-w-0 items-center gap-2 rounded-full border border-border/70 bg-background/72 px-3 py-2 text-sm text-foreground transition-colors hover:bg-card"
                    aria-label={translateWithFallback(
                      t,
                      'modpacks.recent_open',
                      `Open recent modpack ${modpack.title}`,
                      { name: modpack.title },
                    )}
                  >
                    <span className={cn(
                      'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]',
                      modpack.platform === 'curseforge'
                        ? 'border border-amber-500/30 bg-amber-500/10 text-amber-300'
                        : 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
                    )}>
                      {modpack.platform === 'curseforge'
                        ? translateWithFallback(t, 'modpacks.platform_curseforge', 'CurseForge')
                        : translateWithFallback(t, 'modpacks.platform_modrinth', 'Modrinth')}
                    </span>
                    <span className="max-w-[14rem] truncate">{modpack.title}</span>
                  </button>
                ))}
              </div>
            ) : null}
          />
        )}

        {/* History View */}
        {showHistory && (
          <div className="space-y-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-foreground">
                {t('modpacks.history') || 'История'} ({formatNumber(history.length)})
              </h3>
              {history.length > 0 && (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={clearHistory}
                >
                  {t('modpacks.clear_history') || 'Очистить историю'}
                </Button>
              )}
            </div>

            {history.length === 0 ? (
              <div className="surface-muted py-12 text-center text-secondary">
                {t('modpacks.no_history') || 'История просмотров пуста'}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" role="list" aria-label={t('modpacks.history') || 'Viewed modpacks'}>
                {history.map(renderModpackCard)}
              </div>
            )}
          </div>
        )}

        {/* Search Results */}
        {!showHistory && loading && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <LoadingSpinner size="lg" />
            <p className="text-sm text-secondary">
              {t('modpacks.loading')}
            </p>
          </div>
        )}

        {!showHistory && !loading && paginatedResults.length === 0 && (
          searchError ? (
            <DegradedStateView
              variant="error"
              label={t('degraded.error_label')}
              title={browserErrorTitle}
              description={browserErrorDescription}
              footer={(
                <Button variant="secondary" size="sm" onClick={() => void searchModpacks()}>
                  {t('modpacks.search_btn')}
                </Button>
              )}
            />
          ) : hasSearchFilters ? (
            <DegradedStateView
              variant="zero-results"
              label={t('degraded.zero_results_label')}
              title={t('modpacks.no_results')}
              description={t('modpacks.try_changing_filters')}
              footer={(
                <Button variant="secondary" size="sm" onClick={handleResetFilters}>
                  {t('modpacks.clear_filters')}
                </Button>
              )}
            />
          ) : (
            <DegradedStateView
              variant="empty"
              label={t('degraded.empty_label')}
              title={t('modpacks.results_summary_empty')}
              description={t('modpacks.browser_desc')}
              footer={(
                <Button variant="secondary" size="sm" onClick={() => void handleImport()}>
                  <Import className="h-4 w-4" />
                  {t('modpacks.import')}
                </Button>
              )}
            />
          )
        )}

        {!showHistory && !loading && paginatedResults.length > 0 && (
          <div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-4" role="list" aria-label={t('modpacks.browser') || 'Modpack results'}>
              {paginatedResults.map(renderModpackCard)}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-4">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  {t('modpacks.prev') || 'Назад'}
                </Button>
                <span className="text-sm text-secondary">
                  {t('modpacks.page') || 'Страница'} {formattedCurrentPage} {t('modpacks.of') || 'из'} {formattedTotalPages} ({formattedTotalResults} {t('modpacks.total') || 'всего'})
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  {t('modpacks.next') || 'Вперед'}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
};
