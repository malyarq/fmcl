import React, { useState, useEffect, useCallback } from 'react';
import { useSettings } from '../../contexts/SettingsContext';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { cn } from '../../utils/cn';
import type { ModpackSearchResultItem, ModpackVersionDescriptor } from '@shared/contracts';
import { Button } from '../ui/Button';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { modpacksIPC } from '../../services/ipc/modpacksIPC';
import { dialogIPC } from '../../services/ipc/dialogIPC';
import { MINECRAFT_VERSIONS } from '../../utils/minecraftVersionsList';

type Platform = 'curseforge' | 'modrinth';
type SortOption = 'popularity' | 'date' | 'alphabetical';
type FilterMCVersion = string | 'all';
type FilterLoader = string | 'all';

interface ModpackBrowserProps {
  onBack: () => void;
  onNavigate: (view: { type: 'install'; modpack: any; versions: any[]; platform: 'curseforge' | 'modrinth' } | { type: 'importPreview'; filePath: string }) => void;
}

export const ModpackBrowser: React.FC<ModpackBrowserProps> = ({ onBack, onNavigate }) => {
  const { t, getAccentStyles } = useSettings();
  const [platform, setPlatform] = useState<Platform>('modrinth');
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ModpackSearchResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [, setSelectedModpack] = useState<ModpackSearchResultItem | null>(null);
  const [, setVersions] = useState<ModpackVersionDescriptor[]>([]);
  const [sortBy, setSortBy] = useState<SortOption>('popularity');
  const [filterMCVersion, setFilterMCVersion] = useState<FilterMCVersion>('all');
  const [filterLoader, setFilterLoader] = useState<FilterLoader>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [totalResults, setTotalResults] = useState(0);
  const itemsPerPage = 12;

  // Load favorites from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('modpack-favorites');
    if (saved) {
      try {
        setFavorites(new Set(JSON.parse(saved)));
      } catch (e) {
        console.error('Error loading favorites:', e);
      }
    }
  }, []);

  // Save favorites to localStorage
  const saveFavorites = useCallback((newFavorites: Set<string>) => {
    setFavorites(newFavorites);
    localStorage.setItem('modpack-favorites', JSON.stringify(Array.from(newFavorites)));
  }, []);

  const toggleFavorite = useCallback((projectId: string) => {
    const newFavorites = new Set(favorites);
    if (newFavorites.has(projectId)) {
      newFavorites.delete(projectId);
    } else {
      newFavorites.add(projectId);
    }
    saveFavorites(newFavorites);
  }, [favorites, saveFavorites]);

  const searchModpacks = useCallback(async () => {
    setLoading(true);
    try {
      // Используем пустую строку для получения популярных модпаков, если запрос пустой
      const searchQuery = query.trim() || '';
      
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
  }, [query, platform, filterMCVersion, filterLoader, sortBy, currentPage, itemsPerPage]);

  useEffect(() => {
    // Сбрасываем на первую страницу при изменении фильтров
    setCurrentPage(1);
  }, [query, platform, filterMCVersion, filterLoader, sortBy]);

  useEffect(() => {
    // Выполняем поиск сразу при открытии и при изменении платформы
    // Для пустого запроса используем debounce только при вводе текста
    if (query.trim()) {
      const timeoutId = setTimeout(() => {
        searchModpacks();
      }, 500);
      return () => clearTimeout(timeoutId);
    } else {
      // При пустом запросе выполняем поиск сразу (популярные модпаки)
      searchModpacks();
    }
  }, [query, platform, filterMCVersion, filterLoader, sortBy, currentPage, searchModpacks]);

  const handleModpackClick = async (modpack: ModpackSearchResultItem) => {
    setSelectedModpack(modpack);
    setLoading(true);
    try {
      let versionsList: ModpackVersionDescriptor[];
      
      if (platform === 'curseforge') {
        versionsList = await modpacksIPC.getCurseForgeVersions(Number(modpack.projectId));
      } else {
        versionsList = await modpacksIPC.getModrinthVersions(modpack.projectId);
      }
      
      setVersions(versionsList);
      onNavigate({ type: 'install', modpack, versions: versionsList, platform });
    } catch (error) {
      console.error('Error loading versions:', error);
    } finally {
      setLoading(false);
    }
  };

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


  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header with back button, title, platform tabs, import */}
      <div className="flex items-center gap-4 p-6 border-b border-zinc-200 dark:border-zinc-700 bg-white/60 dark:bg-zinc-900/40 min-w-0 flex-wrap">
          <Button
            variant="secondary"
            size="sm"
            onClick={onBack}
            className="flex items-center gap-2 shrink-0"
          >
            <span>←</span>
            {t('general.back') || 'Назад'}
          </Button>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white shrink-0">
            {t('modpacks.browser')}
          </h2>
          <div className="flex gap-2 shrink-0 items-center">
            <button
              onClick={() => setPlatform('curseforge')}
              disabled
              className={cn(
                "px-4 py-2 rounded-lg font-medium transition-colors text-sm",
                "bg-zinc-200 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-500",
                "cursor-not-allowed opacity-60"
              )}
              title={t('modpacks.curseforge_wip') || 'CurseForge в разработке'}
            >
              {t('modpacks.platform_curseforge')} (WIP)
            </button>
            <button
              onClick={() => setPlatform('modrinth')}
              className={cn(
                "px-4 py-2 rounded-lg font-medium transition-colors text-sm",
                platform === 'modrinth'
                  ? cn("text-white", getAccentStyles('bg').className)
                  : "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-600"
              )}
              style={platform === 'modrinth' ? getAccentStyles('bg').style : undefined}
            >
              {t('modpacks.platform_modrinth')}
            </button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleImport}
              className="shrink-0 ml-2"
            >
              {t('modpacks.import') || 'Импорт'}
            </Button>
          </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 min-h-0 custom-scrollbar">
        {/* Search and Filters */}
        <div className="mb-4 space-y-3">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('modpacks.search_placeholder')}
                className="w-full"
              />
              
              <div className="flex gap-2 flex-wrap">
                <Select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="flex-1 min-w-[150px]"
                >
                  <option value="popularity">{t('modpacks.sort_popularity') || 'По популярности'}</option>
                  <option value="alphabetical">{t('modpacks.sort_alphabetical') || 'По алфавиту'}</option>
                  <option value="date">{t('modpacks.sort_date') || 'По дате'}</option>
                </Select>
                
                <Select
                  value={filterMCVersion}
                  onChange={(e) => setFilterMCVersion(e.target.value as FilterMCVersion)}
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
                  className="flex-1 min-w-[150px]"
                >
                  <option value="all">{t('modpacks.filter_all_loaders') || 'Все модлоадеры'}</option>
                  <option value="forge">Forge</option>
                  <option value="fabric">Fabric</option>
                  <option value="neoforge">NeoForge</option>
                </Select>
              </div>
        </div>

        {/* Results */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
                <LoadingSpinner size="lg" />
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  {t('modpacks.loading')}
                </p>
          </div>
        )}

        {!loading && paginatedResults.length === 0 && (
          <div className="text-center py-8 text-zinc-500 dark:text-zinc-400">
                {query.trim() 
                  ? t('modpacks.no_results')
                  : t('modpacks.loading_popular') || 'Загрузка популярных модпаков...'}
          </div>
        )}

        {!loading && paginatedResults.length > 0 && (
          <div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  {paginatedResults.map((modpack) => (
                  <div
                    key={modpack.projectId}
                    onClick={() => handleModpackClick(modpack)}
                    className="p-4 border border-zinc-200 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-900/50 cursor-pointer transition-colors relative"
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(modpack.projectId);
                      }}
                      className="absolute top-2 right-2 p-1.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                      title={favorites.has(modpack.projectId) ? t('modpacks.remove_favorite') || 'Удалить из избранного' : t('modpacks.add_favorite') || 'Добавить в избранное'}
                    >
                      <span className={cn(
                        'text-lg',
                        favorites.has(modpack.projectId) ? 'text-yellow-500' : 'text-zinc-400'
                      )}>
                        {favorites.has(modpack.projectId) ? '★' : '☆'}
                      </span>
                    </button>
                    <div className="flex gap-4">
                      {modpack.iconUrl && (
                        <img
                          src={modpack.iconUrl}
                          alt={modpack.title}
                          className="w-16 h-16 rounded-lg object-cover"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-zinc-900 dark:text-white truncate">
                          {modpack.title}
                        </h4>
                        {modpack.description && (
                          <p className="text-sm text-zinc-600 dark:text-zinc-400 line-clamp-2 mt-1">
                            {modpack.description}
                          </p>
                        )}
                        {modpack.downloads !== undefined && (
                          <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-2">
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
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1 rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zinc-300 dark:hover:bg-zinc-600"
                    >
                      {t('modpacks.prev') || 'Назад'}
                    </button>
                    <span className="text-sm text-zinc-600 dark:text-zinc-400">
                      {t('modpacks.page') || 'Страница'} {currentPage} {t('modpacks.of') || 'из'} {totalPages} ({totalResults} {t('modpacks.total') || 'всего'})
                    </span>
                    <button
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1 rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zinc-300 dark:hover:bg-zinc-600"
                    >
                      {t('modpacks.next') || 'Вперед'}
                    </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
