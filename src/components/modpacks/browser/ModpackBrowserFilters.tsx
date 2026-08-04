import type { ProviderCatalogSearchResultItem } from '@shared/contracts';
import { History } from 'lucide-react';
import type { ModLoaderType } from '../../../contexts/instances/types';
import { useSettings } from '../../../contexts/SettingsContext';
import {
  DEFAULT_MODPACK_BROWSER_STATE,
  type ModpackBrowserState,
} from '../../../features/modpacks/hooks/useModpackNavigation';
import { MINECRAFT_VERSIONS } from '../../../utils/minecraftVersionsList';
import { cn } from '../../../utils/cn';
import { getModloaderDisplayLabel } from '../../sidebar/modpackRuntimeDependencies';
import { ModpackCatalogControls } from '../ModpackCatalogControls';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
import { Select } from '../../ui/Select';

type Translate = (key: string, params?: Record<string, string | number>) => string;

function identityOf(modpack: Pick<ProviderCatalogSearchResultItem, 'projectId' | 'platform'>): string {
  return `${modpack.platform}:${modpack.projectId}`;
}

function translateWithFallback(
  t: Translate,
  key: string,
  fallback: string,
  params?: Record<string, string | number>,
): string {
  const value = t(key, params);
  return value === key ? fallback : value;
}

function loaderLabel(t: Translate, loader: string): string {
  if (!loader) return loader;
  return getModloaderDisplayLabel({ type: loader.toLowerCase() as ModLoaderType }, t);
}

export interface ModpackBrowserFiltersProps {
  query: string;
  onQueryChange: (value: string) => void;
  sortBy: ModpackBrowserState['sortBy'];
  onSortByChange: (value: ModpackBrowserState['sortBy']) => void;
  filterMCVersion: ModpackBrowserState['filterMCVersion'];
  onFilterMCVersionChange: (value: ModpackBrowserState['filterMCVersion']) => void;
  filterLoader: ModpackBrowserState['filterLoader'];
  onFilterLoaderChange: (value: ModpackBrowserState['filterLoader']) => void;
  itemsPerPage: number;
  onItemsPerPageChange: (value: number) => void;
  hasActiveFilters: boolean;
  onResetFilters: () => void;
  recentHistory: ProviderCatalogSearchResultItem[];
  onOpenHistory: () => void;
  onOpenModpack: (modpack: ProviderCatalogSearchResultItem) => void;
}

export function ModpackBrowserFilters({
  query,
  onQueryChange,
  sortBy,
  onSortByChange,
  filterMCVersion,
  onFilterMCVersionChange,
  filterLoader,
  onFilterLoaderChange,
  itemsPerPage,
  onItemsPerPageChange,
  hasActiveFilters,
  onResetFilters,
  recentHistory,
  onOpenHistory,
  onOpenModpack,
}: ModpackBrowserFiltersProps) {
  const { t, getAccentStyles } = useSettings();
  const accent = getAccentStyles('bg');
  const activeFilterTokens = [];
  if (query.trim()) activeFilterTokens.push(`${translateWithFallback(t, 'modpacks.search', 'Search modpacks')}: "${query.trim()}"`);
  if (filterMCVersion !== DEFAULT_MODPACK_BROWSER_STATE.filterMCVersion) {
    activeFilterTokens.push(`${translateWithFallback(t, 'modpacks.minecraft_version', 'Minecraft Version')}: ${filterMCVersion}`);
  }
  if (filterLoader !== DEFAULT_MODPACK_BROWSER_STATE.filterLoader) {
    activeFilterTokens.push(`${translateWithFallback(t, 'modpacks.loader', 'Modloader')}: ${loaderLabel(t, filterLoader)}`);
  }
  if (sortBy !== DEFAULT_MODPACK_BROWSER_STATE.sortBy) {
    activeFilterTokens.push(sortBy === 'alphabetical'
      ? translateWithFallback(t, 'modpacks.sort_alphabetical', 'Alphabetical')
      : translateWithFallback(t, 'modpacks.sort_date', 'Date'));
  }

  return (
    <ModpackCatalogControls
      rootTestId="remote-modpack-filters"
      headerTestId="remote-modpack-catalog-header"
      controlsTestId="remote-modpack-filter-controls"
      header={(
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-foreground">{t('modpacks.browser')}</h2>
            <span className={cn('rounded-full px-3 py-1 text-xs font-semibold text-white', accent.className)} style={accent.style}>
              {translateWithFallback(t, 'modpacks.platform_modrinth', 'Modrinth')}
            </span>
            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-300">
              {translateWithFallback(t, 'modpacks.provider_curseforge_unavailable', 'CurseForge browse unavailable')}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2" data-testid="remote-modpack-primary-actions">
            <Button
              variant="secondary"
              size="sm"
              geometry="catalog-primary"
              onClick={onOpenHistory}
              className="min-h-10 flex-1 justify-center gap-2 px-4 sm:flex-none"
              title={t('modpacks.history_tooltip') || 'История просмотров'}
            >
              <History className="h-4 w-4 shrink-0" />
              {t('modpacks.history') || 'История'}
            </Button>
          </div>
        </div>
      )}
      searchLabel={t('modpacks.search') || 'Search modpacks'}
      searchControl={(
        <Input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={t('modpacks.search_placeholder')}
          aria-label={t('modpacks.search_placeholder') || 'Search modpacks'}
          className="w-full"
          data-testid="remote-modpack-search"
          maxLength={200}
        />
      )}
      controls={[
        {
          key: 'sort',
          label: sortBy === 'alphabetical'
            ? translateWithFallback(t, 'modpacks.sort_alphabetical', 'Alphabetical')
            : sortBy === 'date'
              ? translateWithFallback(t, 'modpacks.sort_date', 'Date')
              : translateWithFallback(t, 'modpacks.sort_popularity', 'Popularity'),
          control: (
            <Select
              value={sortBy}
              onChange={(event) => onSortByChange(event.target.value as ModpackBrowserState['sortBy'])}
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
              onChange={(event) => onFilterMCVersionChange(event.target.value)}
              aria-label={t('modpacks.filter_all') || 'Filter by Minecraft version'}
              className="w-full"
              data-testid="remote-modpack-version-filter"
            >
              <option value="all">{t('modpacks.filter_all') || 'Все версии MC'}</option>
              {MINECRAFT_VERSIONS.filter((version) => version.type === 'release').map((version) => (
                <option key={version.id} value={version.id}>{version.id}</option>
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
              onChange={(event) => onFilterLoaderChange(event.target.value)}
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
              onChange={(event) => onItemsPerPageChange(Number(event.target.value))}
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
      onReset={hasActiveFilters ? onResetFilters : undefined}
      resetLabel={translateWithFallback(t, 'modpacks.clear_filters', 'Clear filters')}
      footer={recentHistory.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {recentHistory.map((modpack) => (
            <button
              key={identityOf(modpack)}
              type="button"
              onClick={() => onOpenModpack(modpack)}
              className="inline-flex min-w-0 items-center gap-2 rounded-full border border-border/70 bg-background/72 px-3 py-2 text-sm text-foreground transition-colors hover:bg-card"
              aria-label={translateWithFallback(t, 'modpacks.recent_open', `Open recent modpack ${modpack.title}`, { name: modpack.title })}
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
  );
}
