import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSettings } from '../../contexts/SettingsContext';
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

function formatCompactCount(value: number): string {
  return new Intl.NumberFormat(undefined, {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

function formatDateLabel(value?: string): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date);
}

export const ModpackBrowser: React.FC<ModpackBrowserProps> = ({ initialState, onBack, onNavigate, onStateChange }) => {
  const { t, getAccentStyles } = useSettings();
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
  const hasActiveFilters =
    query.trim().length > 0
    || filterMCVersion !== DEFAULT_MODPACK_BROWSER_STATE.filterMCVersion
    || filterLoader !== DEFAULT_MODPACK_BROWSER_STATE.filterLoader
    || sortBy !== DEFAULT_MODPACK_BROWSER_STATE.sortBy;
  const showingStart = totalResults > 0 ? ((currentPage - 1) * itemsPerPage) + 1 : 0;
  const showingEnd = totalResults > 0 ? showingStart + paginatedResults.length - 1 : 0;
  const recentHistory = useMemo(() => history.slice(0, 3), [history]);
  const activeFilterTokens = useMemo(() => {
    const tokens: string[] = [];

    if (query.trim().length > 0) {
      tokens.push(`"${query.trim()}"`);
    }
    if (filterMCVersion !== DEFAULT_MODPACK_BROWSER_STATE.filterMCVersion) {
      tokens.push(`MC ${filterMCVersion}`);
    }
    if (filterLoader !== DEFAULT_MODPACK_BROWSER_STATE.filterLoader) {
      tokens.push(filterLoader);
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
    const providerLabel = modpack.platform === 'curseforge'
      ? translateWithFallback(t, 'modpacks.platform_curseforge', 'CurseForge')
      : translateWithFallback(t, 'modpacks.platform_modrinth', 'Modrinth');
    const updatedLabel = formatDateLabel(modpack.dateModified ?? modpack.dateCreated);
    const favoritesActionLabel = isFavorite(modpack)
      ? translateWithFallback(t, 'modpacks.remove_favorite', 'Remove favorite')
      : translateWithFallback(t, 'modpacks.add_favorite', 'Add favorite');

    return (
      <div
        key={getModpackIdentity(modpack)}
        role="listitem"
        onClick={() => {
          void handleModpackClick(modpack);
        }}
        className="surface-card relative cursor-pointer p-4 transition-colors hover:border-border-active hover:bg-card focus-within:ring-2 focus-within:ring-zinc-500 focus-within:ring-offset-2 dark:focus-within:ring-offset-zinc-900"
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
          className="absolute inset-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2 dark:focus:ring-offset-zinc-900"
        />
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            toggleFavorite(modpack);
          }}
          aria-pressed={isFavorite(modpack)}
          aria-label={`${favoritesActionLabel}: ${modpack.title}`}
          className="absolute top-2 right-2 rounded-full p-1.5 transition-colors hover:bg-background/70"
          title={favoritesActionLabel}
        >
          <Star className={cn('h-5 w-5', isFavorite(modpack) ? 'fill-yellow-400 text-yellow-500' : 'text-muted')} />
        </button>
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
              {updatedLabel && (
                <span className="text-xs text-secondary">
                  {translateWithFallback(t, 'modpacks.updated', 'Updated')}: {updatedLabel}
                </span>
              )}
            </div>
            <h4 className="truncate font-semibold text-foreground">
              {modpack.title}
            </h4>
            {modpack.description && (
              <p className="mt-1 line-clamp-2 text-sm text-secondary">
                {modpack.description}
              </p>
            )}
            <div className="mt-2 flex flex-wrap gap-3 text-xs text-secondary">
              {modpack.downloads !== undefined && (
                <span>
                  {translateWithFallback(t, 'modpacks.downloads', 'Downloads')}: {formatCompactCount(modpack.downloads)}
                </span>
              )}
              <span>
                {translateWithFallback(t, 'modpacks.open_details', 'Open details')}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }, [handleCardKeyDown, handleModpackClick, isFavorite, t, toggleFavorite]);


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
            variant={showHistory ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setShowHistory(!showHistory)}
            aria-pressed={showHistory}
            className="shrink-0 ml-2"
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
          <div className="surface-muted mb-4 space-y-3 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-secondary">
                  <span className="rounded-full border border-border/70 bg-background/72 px-3 py-1">
                    {translateWithFallback(t, 'modpacks.platform_modrinth', 'Modrinth')}
                  </span>
                  <span className="rounded-full border border-border/70 bg-background/72 px-3 py-1">
                    {totalResults > 0
                      ? translateWithFallback(
                        t,
                        'modpacks.results_summary',
                        `Showing ${showingStart}-${showingEnd} of ${totalResults}`,
                        { start: showingStart, end: showingEnd, total: totalResults }
                      )
                      : translateWithFallback(t, 'modpacks.results_summary_empty', 'No results yet')}
                  </span>
                  {totalPages > 1 && (
                    <span className="rounded-full border border-border/70 bg-background/72 px-3 py-1">
                      {translateWithFallback(
                        t,
                        'modpacks.results_page_summary',
                        `Page ${currentPage} of ${totalPages}`,
                        { current: currentPage, total: totalPages }
                      )}
                    </span>
                  )}
                </div>
                {activeFilterTokens.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 text-xs text-secondary">
                    <span className="font-medium text-foreground">
                      {translateWithFallback(t, 'modpacks.active_filters', 'Active filters')}
                    </span>
                    {activeFilterTokens.map((token) => (
                      <span key={token} className="rounded-full border border-border/70 bg-background/72 px-2.5 py-1">
                        {token}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleResetFilters}
                  className="shrink-0"
                >
                  {translateWithFallback(t, 'modpacks.clear_filters', 'Clear filters')}
                </Button>
              )}
            </div>

            {recentHistory.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-medium uppercase tracking-[0.16em] text-secondary">
                  {translateWithFallback(t, 'modpacks.recently_viewed', 'Recently viewed')}
                </div>
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
                        { name: modpack.title }
                      )}
                    >
                      <span className={cn(
                        'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]',
                        modpack.platform === 'curseforge'
                          ? 'border border-amber-500/30 bg-amber-500/10 text-amber-300'
                          : 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                      )}>
                        {modpack.platform === 'curseforge'
                          ? translateWithFallback(t, 'modpacks.platform_curseforge', 'CurseForge')
                          : translateWithFallback(t, 'modpacks.platform_modrinth', 'Modrinth')}
                      </span>
                      <span className="max-w-[14rem] truncate">{modpack.title}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Search and Filters */}
        {!showHistory && (
          <div
            className="surface-muted mb-4 space-y-3 p-4"
            role="search"
            aria-label={t('modpacks.search_placeholder') || 'Search modpacks'}
            data-testid="remote-modpack-filters"
          >
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('modpacks.search_placeholder')}
              aria-label={t('modpacks.search_placeholder') || 'Search modpacks'}
              className="w-full"
              data-testid="remote-modpack-search"
            />

            <div className="flex flex-wrap items-start gap-2" data-testid="remote-modpack-filter-controls">
              <Select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                aria-label={t('modpacks.sort_popularity') || 'Sort modpacks'}
                className="min-w-[11rem] flex-1"
                data-testid="remote-modpack-sort"
              >
                <option value="popularity">{t('modpacks.sort_popularity') || 'По популярности'}</option>
                <option value="alphabetical">{t('modpacks.sort_alphabetical') || 'По алфавиту'}</option>
                <option value="date">{t('modpacks.sort_date') || 'По дате'}</option>
              </Select>

              <Select
                value={filterMCVersion}
                onChange={(e) => setFilterMCVersion(e.target.value as FilterMCVersion)}
                aria-label={t('modpacks.filter_all') || 'Filter by Minecraft version'}
                className="min-w-[11rem] flex-1"
                data-testid="remote-modpack-version-filter"
              >
                <option value="all">{t('modpacks.filter_all') || 'Все версии MC'}</option>
                {MINECRAFT_VERSIONS.filter(v => v.type === 'release').map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.id}
                  </option>
                ))}
              </Select>

              <Select
                value={filterLoader}
                onChange={(e) => setFilterLoader(e.target.value as FilterLoader)}
                aria-label={t('modpacks.filter_all_loaders') || 'Filter by modloader'}
                className="min-w-[11rem] flex-1"
                data-testid="remote-modpack-loader-filter"
              >
                <option value="all">{t('modpacks.filter_all_loaders') || 'Все модлоадеры'}</option>
                <option value="forge">Forge</option>
                <option value="fabric">Fabric</option>
                <option value="neoforge">NeoForge</option>
              </Select>

              <Select
                value={String(itemsPerPage)}
                onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
                aria-label={t('modpacks.items_per_page') || 'Items per page'}
                className="min-w-[8.5rem] flex-none sm:basis-[8.5rem]"
                title={t('modpacks.items_per_page') || 'Элементов на странице'}
                data-testid="remote-modpack-items-per-page"
              >
                <option value="12">12</option>
                <option value="24">24</option>
                <option value="48">48</option>
              </Select>
            </div>
          </div>


        )}

        {/* History View */}
        {showHistory && (
          <div className="space-y-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-foreground">
                {t('modpacks.history') || 'История'} ({history.length})
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
          <div className="surface-muted py-8 text-center text-secondary">
            {query.trim()
              ? t('modpacks.no_results')
              : t('modpacks.loading_popular') || 'Загрузка популярных модпаков...'}
          </div>
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
                  {t('modpacks.page') || 'Страница'} {currentPage} {t('modpacks.of') || 'из'} {totalPages} ({totalResults} {t('modpacks.total') || 'всего'})
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
