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
import { DEFAULT_MODPACK_BROWSER_STATE, type ModpackBrowserState } from '../../features/modpacks/hooks/useModpackNavigation';
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

export const ModpackBrowser: React.FC<ModpackBrowserProps> = ({ initialState, onBack, onNavigate, onStateChange }) => {
  const { t, getAccentStyles } = useSettings();
  const [platform, setPlatform] = useState<Platform>(initialState.platform);
  const [query, setQuery] = useState(initialState.query);
  const [searchResults, setSearchResults] = useState<ModpackSearchResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [, setSelectedModpack] = useState<ModpackSearchResultItem | null>(null);
  const [, setVersions] = useState<ModpackVersionDescriptor[]>([]);
  const [sortBy, setSortBy] = useState<SortOption>(initialState.sortBy);
  const [filterMCVersion, setFilterMCVersion] = useState<FilterMCVersion>(initialState.filterMCVersion);
  const [filterLoader, setFilterLoader] = useState<FilterLoader>(initialState.filterLoader);
  const [currentPage, setCurrentPage] = useState(initialState.currentPage);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [totalResults, setTotalResults] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(() => {
    const saved = localStorage.getItem('modpack-items-per-page');
    if (!saved) {
      return initialState.itemsPerPage;
    }

    if (initialState.itemsPerPage !== DEFAULT_MODPACK_BROWSER_STATE.itemsPerPage) {
      return initialState.itemsPerPage;
    }

    const parsed = Number(saved);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : initialState.itemsPerPage;
  });
  const [showHistory, setShowHistory] = useState(initialState.showHistory);
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
        </div>
        <div className="flex gap-2 shrink-0 items-center">
          <div role="tablist" aria-label={t('modpacks.browser')} className="flex gap-2">
            <button
              type="button"
              role="tab"
              aria-selected={platform === 'curseforge'}
              tabIndex={platform === 'curseforge' ? 0 : -1}
              onClick={() => setPlatform('curseforge')}
              disabled
              className={cn(
                "px-4 py-2 rounded-lg font-medium transition-colors text-sm",
                "bg-background/72 text-muted",
                "cursor-not-allowed opacity-60"
              )}
              title={t('modpacks.curseforge_wip') || 'CurseForge в разработке'}
            >
              {t('modpacks.platform_curseforge')} ({t('modpacks.coming_soon_short') || 'Soon'})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={platform === 'modrinth'}
              tabIndex={platform === 'modrinth' ? 0 : -1}
              onClick={() => setPlatform('modrinth')}
              className={cn(
                "px-4 py-2 rounded-lg font-medium transition-colors text-sm",
                platform === 'modrinth'
                  ? cn("text-white", getAccentStyles('bg').className)
                  : "bg-background/72 text-foreground hover:bg-card"
              )}
              style={platform === 'modrinth' ? getAccentStyles('bg').style : undefined}
            >
              {t('modpacks.platform_modrinth')}
            </button>
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
        {/* Search and Filters */}
        {!showHistory && (
          <div className="surface-muted mb-4 space-y-3 p-4" role="search" aria-label={t('modpacks.search_placeholder') || 'Search modpacks'}>
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('modpacks.search_placeholder')}
              aria-label={t('modpacks.search_placeholder') || 'Search modpacks'}
              className="w-full"
            />

            <div className="flex gap-2 flex-wrap">
              <Select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                aria-label={t('modpacks.sort_popularity') || 'Sort modpacks'}
                className="flex-1 min-w-[150px]"
              >
                <option value="popularity">{t('modpacks.sort_popularity') || 'По популярности'}</option>
                <option value="alphabetical">{t('modpacks.sort_alphabetical') || 'По алфавиту'}</option>
                <option value="date">{t('modpacks.sort_date') || 'По дате'}</option>
              </Select>

              <Select
                value={filterMCVersion}
                onChange={(e) => setFilterMCVersion(e.target.value as FilterMCVersion)}
                aria-label={t('modpacks.filter_all') || 'Filter by Minecraft version'}
                className="flex-1 min-w-[150px]"
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
                className="flex-1 min-w-[150px]"
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
                className="w-[100px]"
                title={t('modpacks.items_per_page') || 'Элементов на странице'}
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4" role="list" aria-label={t('modpacks.history') || 'Viewed modpacks'}>
                {history.map((modpack) => (
                  <div
                    key={getModpackIdentity(modpack)}
                    role="listitem"
                    onClick={() => handleModpackClick(modpack)}
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
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(modpack);
                      }}
                      aria-pressed={isFavorite(modpack)}
                      aria-label={`${isFavorite(modpack) ? t('modpacks.remove_favorite') || 'Remove favorite' : t('modpacks.add_favorite') || 'Add favorite'}: ${modpack.title}`}
                      className="absolute top-2 right-2 rounded-full p-1.5 transition-colors hover:bg-background/70"
                      title={isFavorite(modpack) ? t('modpacks.remove_favorite') || 'Удалить из избранного' : t('modpacks.add_favorite') || 'Добавить в избранное'}
                    >
                      <Star className={cn('h-5 w-5', isFavorite(modpack) ? 'fill-yellow-400 text-yellow-500' : 'text-muted')} />
                    </button>
                    <div className="flex gap-4">
                      {modpack.iconUrl && (
                        <LazyImage
                          src={modpack.iconUrl}
                          alt={modpack.title}
                          className="h-16 w-16 rounded-2xl border border-border/70 object-cover"
                          fallback="/icon.png"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <h4 className="truncate font-semibold text-foreground">
                          {modpack.title}
                        </h4>
                        {modpack.description && (
                          <p className="mt-1 line-clamp-2 text-sm text-secondary">
                            {modpack.description}
                          </p>
                        )}
                        {modpack.downloads !== undefined && (
                          <p className="mt-2 text-xs text-secondary">
                            {t('modpacks.downloads')}: {modpack.downloads.toLocaleString()}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4" role="list" aria-label={t('modpacks.browser') || 'Modpack results'}>
              {paginatedResults.map((modpack) => (
                  <div
                    key={getModpackIdentity(modpack)}
                    role="listitem"
                    onClick={() => handleModpackClick(modpack)}
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
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavorite(modpack);
                    }}
                    aria-pressed={isFavorite(modpack)}
                    aria-label={`${isFavorite(modpack) ? t('modpacks.remove_favorite') || 'Remove favorite' : t('modpacks.add_favorite') || 'Add favorite'}: ${modpack.title}`}
                    className="absolute top-2 right-2 rounded-full p-1.5 transition-colors hover:bg-background/70"
                    title={isFavorite(modpack) ? t('modpacks.remove_favorite') || 'Удалить из избранного' : t('modpacks.add_favorite') || 'Добавить в избранное'}
                  >
                    <Star className={cn('h-5 w-5', isFavorite(modpack) ? 'fill-yellow-400 text-yellow-500' : 'text-muted')} />
                  </button>
                  <div className="flex gap-4">
                    {modpack.iconUrl && (
                      <LazyImage
                        src={modpack.iconUrl}
                        alt={modpack.title}
                        className="h-16 w-16 rounded-2xl border border-border/70 object-cover"
                        fallback="/icon.png"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <h4 className="truncate font-semibold text-foreground">
                        {modpack.title}
                      </h4>
                      {modpack.description && (
                        <p className="mt-1 line-clamp-2 text-sm text-secondary">
                          {modpack.description}
                        </p>
                      )}
                      {modpack.downloads !== undefined && (
                        <p className="mt-2 text-xs text-secondary">
                          {t('modpacks.downloads')}: {modpack.downloads.toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
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
