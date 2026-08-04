import { memo, useMemo, type ChangeEvent, type KeyboardEvent } from 'react';
import { Compass, FolderOpen, MoreHorizontal } from 'lucide-react';
import type { ModLoaderType } from '../../../contexts/instances/types';
import { useSettings } from '../../../contexts/SettingsContext';
import { buildModpackRuntimeSummary } from '../../../features/modpacks/hooks/useModpackRuntimeSummary';
import type { ModpackUpdateInfo } from '../../../features/modpacks/hooks/useModpackUpdates';
import { cn } from '../../../utils/cn';
import { toDisplayErrorMessage } from '../../../utils/displayError';
import { DegradedStateView } from '../../layout/DegradedStateView';
import { ModpackCatalogControls } from '../ModpackCatalogControls';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
import { LazyImage } from '../../ui/LazyImage';
import { Select } from '../../ui/Select';
import { SkeletonLoader } from '../../ui/SkeletonLoader';
import { InstalledModpackActions } from './InstalledModpackActions';
import { useInstalledModpackContextMenu } from './installedModpackContextMenuContext';
import {
  INSTALLED_MODPACK_SORT_OPTIONS,
  type InstalledModpackItem,
  type InstalledModpackSortOption,
} from './useInstalledModpackCatalog';

type Translate = (key: string, params?: Record<string, string | number>) => string;

function translateWithFallback(t: Translate, key: string, fallback: string): string {
  const value = t(key);
  return value === key ? fallback : value;
}

function formatLoaderLabel(t: Translate, loader: string): string {
  switch (loader.toLowerCase()) {
    case 'forge': return translateWithFallback(t, 'modpacks.loader_forge', 'Forge');
    case 'fabric': return translateWithFallback(t, 'modpacks.loader_fabric', 'Fabric');
    case 'quilt': return translateWithFallback(t, 'modpacks.loader_quilt', 'Quilt');
    case 'neoforge': return translateWithFallback(t, 'modpacks.loader_neoforge', 'NeoForge');
    case 'vanilla': return translateWithFallback(t, 'modpacks.loader_vanilla', 'Vanilla (no modloader)');
    default: return loader;
  }
}

function formatDateLabel(
  value: string | undefined,
  formatDate: (timestamp: number | undefined, unknownText?: string, options?: Intl.DateTimeFormatOptions) => string,
): string | null {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return null;
  return formatDate(timestamp, '', { dateStyle: 'medium' }) || null;
}

function isContextMenuShortcut(event: KeyboardEvent<HTMLElement>): boolean {
  return event.key === 'ContextMenu'
    || event.code === 'ContextMenu'
    || event.key === 'F10'
    || event.code === 'F10';
}

const InstalledModpackCardSkeleton = memo(function InstalledModpackCardSkeleton() {
  return (
    <div role="listitem" className="surface-card min-h-[200px] p-5">
      <div className="mb-3 flex items-start gap-4">
        <SkeletonLoader variant="rounded" width={80} height={80} />
        <div className="min-w-0 flex-1 space-y-2">
          <SkeletonLoader variant="text" width="60%" height={20} />
          <SkeletonLoader variant="text" width="40%" height={16} />
          <SkeletonLoader variant="text" width="35%" height={16} />
        </div>
      </div>
      <SkeletonLoader variant="text" lines={2} className="mb-3" />
      <div className="mt-3 flex gap-2">
        <SkeletonLoader variant="rounded" width="100%" height={40} />
        <SkeletonLoader variant="rounded" width={90} height={40} />
        <SkeletonLoader variant="rounded" width={90} height={40} />
      </div>
    </div>
  );
});

interface InstalledModpackCardProps {
  item: InstalledModpackItem;
  update?: ModpackUpdateInfo;
  index: number;
  selected: boolean;
  onSelect: (id: string) => void;
  onShowDetails: (id: string) => void;
}

const InstalledModpackCard = memo(function InstalledModpackCard({
  item,
  update,
  index,
  selected,
  onSelect,
  onShowDetails,
}: InstalledModpackCardProps) {
  const { t, getAccentStyles, formatDate } = useSettings();
  const menu = useInstalledModpackContextMenu();
  const runtimeSummary = useMemo(
    () => buildModpackRuntimeSummary({ metadata: item.metadata }),
    [item.metadata],
  );
  const updatedLabel = useMemo(
    () => formatDateLabel(item.metadata.updatedAt ?? item.metadata.createdAt, formatDate),
    [formatDate, item.metadata.createdAt, item.metadata.updatedAt],
  );
  const activeBackground = getAccentStyles('soft-bg');
  const activeBorder = getAccentStyles('soft-border');
  const activeLabel = getAccentStyles('title');
  const menuOpen = menu.activeModpackId === item.id;
  const menuLabel = `${translateWithFallback(t, 'modpacks.actions_title', 'More actions')}: ${item.name}`;
  const detailsText = translateWithFallback(t, 'modpacks.open_details', 'Open details');
  const makeActiveText = translateWithFallback(t, 'modpacks.make_active', 'Make active');
  const activeNowText = translateWithFallback(t, 'modpacks.active_now', 'Active now');

  return (
    <div
      className={cn(
        'surface-card relative flex min-h-[17rem] cursor-pointer flex-col p-4 transition-all duration-300 ease-out',
        'transform animate-fade-in-up hover:-translate-y-1 hover:scale-[1.02] hover:shadow-lg',
        'focus-within:ring-2 focus-within:ring-[rgb(var(--accent-main))] focus-within:ring-offset-2 focus-within:ring-offset-background',
        selected
          ? cn('scale-[1.02] border-border bg-card/90 shadow-[0_18px_36px_rgba(0,0,0,0.18)]', activeBackground.className, activeBorder.className)
          : 'hover:border-border-active hover:bg-card',
      )}
      data-state={selected ? 'active' : 'inactive'}
      style={{
        animationDelay: `${index * 50}ms`,
        ...(selected ? { ...activeBackground.style, ...activeBorder.style } : undefined),
      }}
      role="listitem"
      onContextMenu={(event) => menu.openAtPointer(event, item.id)}
    >
      <button
        type="button"
        aria-label={item.name}
        aria-pressed={selected}
        onClick={() => onSelect(item.id)}
        onKeyDown={(event) => {
          if (isContextMenuShortcut(event)) {
            event.preventDefault();
            menu.openFromKeyboard(event.currentTarget, item.id);
          }
        }}
        className="absolute inset-0 z-10 rounded-xl focus:outline-none"
      />

      <div className="pointer-events-none relative z-20 flex h-full flex-col gap-4">
        <div className="flex items-start gap-4">
          <div className="h-20 w-20 flex-shrink-0">
            <LazyImage
              src={item.metadata.iconUrl}
              alt={item.name}
              fallbackKind="content-artwork"
              className="h-full w-full rounded-2xl border border-border/70 object-cover"
              placeholder={<SkeletonLoader variant="rounded" width={80} height={80} />}
            />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-base font-semibold text-foreground">{item.name}</h3>
            {selected && (
              <div className={cn('mt-1 text-xs font-medium', activeLabel.className)} style={activeLabel.style}>
                {t('modpacks.active')}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-x-6 gap-y-3 text-xs text-secondary">
          {runtimeSummary.minecraftVersion && (
            <div className="min-w-[8rem]">
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                {translateWithFallback(t, 'modpacks.minecraft_version', 'Minecraft Version')}
              </div>
              <div className="mt-1 text-sm font-medium text-foreground">{runtimeSummary.minecraftVersion}</div>
            </div>
          )}
          {updatedLabel && (
            <div className="min-w-[8rem]">
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                {translateWithFallback(t, 'modpacks.updated', 'Updated')}
              </div>
              <div className="mt-1 text-sm font-medium text-foreground">{updatedLabel}</div>
            </div>
          )}
        </div>

        {update && (
          <div
            data-testid={`installed-modpack-update-indicator-${item.id}`}
            data-update-scope="modpack-local"
            className="text-xs font-medium text-secondary"
          >
            {translateWithFallback(t, 'modpacks.update_available', 'Update available')}
          </div>
        )}

        <div
          className="pointer-events-auto relative z-30 mt-auto grid grid-cols-[minmax(0,1fr)_auto] gap-2 pt-1"
          onClick={(event) => event.stopPropagation()}
          data-testid={`installed-modpack-actions-${item.id}`}
        >
          <Button
            variant="primary"
            size="sm"
            geometry="catalog-primary"
            onClick={() => onShowDetails(item.id)}
            className="col-span-2 min-w-0 justify-center transition-all duration-200"
            style={getAccentStyles('bg').style}
            aria-label={`${detailsText}: ${item.name}`}
          >
            <FolderOpen className="h-4 w-4" />
            {detailsText}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            geometry="catalog-primary"
            onClick={() => {
              if (!selected) onSelect(item.id);
            }}
            disabled={selected}
            className="min-w-[8.5rem] transition-all duration-200"
            aria-label={`${selected ? activeNowText : makeActiveText}: ${item.name}`}
          >
            {selected ? activeNowText : makeActiveText}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            geometry="catalog-primary"
            onClick={(event) => menu.openFromButton(event, item.id)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-controls={menuOpen ? `modpack-actions-menu-${item.id}` : undefined}
            aria-label={menuLabel}
            className="px-3 transition-all duration-200"
            title={t('modpacks.actions_title') || 'More actions'}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}, (previous, next) => (
  previous.item.id === next.item.id
  && previous.item.selected === next.item.selected
  && previous.item.name === next.item.name
  && previous.item.metadata === next.item.metadata
  && previous.selected === next.selected
  && previous.update?.latestVersion.versionId === next.update?.latestVersion.versionId
));

export interface InstalledModpackCatalogProps {
  items: InstalledModpackItem[];
  loading: boolean;
  loadError: unknown | null;
  availableUpdatesById: Record<string, ModpackUpdateInfo>;
  selectedId: string;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  minecraftVersion: string;
  onMinecraftVersionChange: (value: string) => void;
  loader: string;
  onLoaderChange: (value: string) => void;
  sort: InstalledModpackSortOption;
  onSortChange: (value: InstalledModpackSortOption) => void;
  availableVersions: string[];
  availableLoaders: ModLoaderType[];
  hasActiveFilters: boolean;
  hasSearchFilters: boolean;
  onResetFilters: () => void;
  onRetry: () => void;
  onSelect: (id: string) => void;
  onShowDetails: (id: string) => void;
  onImportCode: () => void;
  onCreate: () => void;
  onBrowse: () => void;
}

export function InstalledModpackCatalog({
  items,
  loading,
  loadError,
  availableUpdatesById,
  selectedId,
  searchQuery,
  onSearchQueryChange,
  minecraftVersion,
  onMinecraftVersionChange,
  loader,
  onLoaderChange,
  sort,
  onSortChange,
  availableVersions,
  availableLoaders,
  hasActiveFilters,
  hasSearchFilters,
  onResetFilters,
  onRetry,
  onSelect,
  onShowDetails,
  onImportCode,
  onCreate,
  onBrowse,
}: InstalledModpackCatalogProps) {
  const { t } = useSettings();
  const errorTitle = t('error.inline_fallback');
  const errorDescription = loadError
    ? (() => {
      const detail = toDisplayErrorMessage(loadError, errorTitle);
      return detail !== errorTitle ? detail : t('modpacks.desc');
    })()
    : '';
  const activeFilterTokens = useMemo(() => {
    const tokens: string[] = [];
    if (searchQuery.trim()) tokens.push(`${translateWithFallback(t, 'modpacks.search', 'Search modpacks')}: "${searchQuery.trim()}"`);
    if (minecraftVersion !== 'all') tokens.push(`${translateWithFallback(t, 'modpacks.minecraft_version', 'Minecraft Version')}: ${minecraftVersion}`);
    if (loader !== 'all') tokens.push(`${translateWithFallback(t, 'modpacks.loader', 'Modloader')}: ${formatLoaderLabel(t, loader)}`);
    if (sort !== 'name') {
      tokens.push(sort === 'created'
        ? translateWithFallback(t, 'modpacks.sort_created', 'By creation date')
        : translateWithFallback(t, 'modpacks.sort_updated', 'By update date'));
    }
    return tokens;
  }, [loader, minecraftVersion, searchQuery, sort, t]);

  return (
    <>
      <ModpackCatalogControls
        rootTestId="installed-modpack-filters"
        headerTestId="installed-modpack-catalog-header"
        controlsTestId="installed-modpack-filter-controls"
        header={(
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <h2 className="text-base font-semibold text-foreground">{t('modpacks.title')}</h2>
            <InstalledModpackActions onImportCode={onImportCode} onCreate={onCreate} onBrowse={onBrowse} />
          </div>
        )}
        searchLabel={t('modpacks.search') || 'Search modpacks'}
        searchControl={(
          <Input
            value={searchQuery}
            onChange={(event: ChangeEvent<HTMLInputElement>) => onSearchQueryChange(event.target.value)}
            placeholder={t('modpacks.search_placeholder') || 'Поиск модпаков...'}
            aria-label={t('modpacks.search_placeholder') || 'Search modpacks'}
            className="w-full"
            data-testid="installed-modpack-search"
          />
        )}
        controls={[
          {
            key: 'sort',
            label: sort === 'created'
              ? translateWithFallback(t, 'modpacks.sort_created', 'By creation date')
              : sort === 'updated'
                ? translateWithFallback(t, 'modpacks.sort_updated', 'By update date')
                : translateWithFallback(t, 'modpacks.sort_name', 'By name'),
            control: (
              <Select
                value={sort}
                onChange={(event) => {
                  const value = event.target.value as InstalledModpackSortOption;
                  if (INSTALLED_MODPACK_SORT_OPTIONS.includes(value)) onSortChange(value);
                }}
                aria-label={t('modpacks.sort_name') || 'Sort modpacks'}
                className="w-full"
                data-testid="installed-modpack-sort"
              >
                <option value="name">{t('modpacks.sort_name') || 'По имени'}</option>
                <option value="created">{t('modpacks.sort_created') || 'По дате создания'}</option>
                <option value="updated">{t('modpacks.sort_updated') || 'По обновлению'}</option>
              </Select>
            ),
          },
          {
            key: 'version',
            label: translateWithFallback(t, 'modpacks.minecraft_version', 'Minecraft Version'),
            control: (
              <Select
                value={minecraftVersion}
                onChange={(event) => onMinecraftVersionChange(event.target.value)}
                aria-label={t('modpacks.filter_all_versions') || 'Filter by Minecraft version'}
                className="w-full"
                data-testid="installed-modpack-version-filter"
              >
                <option value="all">{t('modpacks.filter_all_versions') || 'Все версии'}</option>
                {availableVersions.map((version) => <option key={version} value={version}>{version}</option>)}
              </Select>
            ),
          },
          {
            key: 'loader',
            label: translateWithFallback(t, 'modpacks.loader', 'Modloader'),
            control: (
              <Select
                value={loader}
                onChange={(event) => onLoaderChange(event.target.value)}
                aria-label={t('modpacks.filter_all_loaders') || 'Filter by modloader'}
                className="w-full"
                data-testid="installed-modpack-loader-filter"
              >
                <option value="all">{t('modpacks.filter_all_loaders') || 'Все лоадеры'}</option>
                {availableLoaders.map((value) => <option key={value} value={value}>{formatLoaderLabel(t, value)}</option>)}
              </Select>
            ),
          },
        ]}
        activeFilterTokens={activeFilterTokens}
        onReset={hasActiveFilters ? onResetFilters : undefined}
        resetLabel={translateWithFallback(t, 'modpacks.clear_filters', 'Clear filters')}
        className="mb-6"
      />

      {loading ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-3" role="list" aria-label={t('modpacks.title') || 'Modpacks'}>
          {Array.from({ length: 6 }).map((_, index) => <InstalledModpackCardSkeleton key={index} />)}
        </div>
      ) : loadError ? (
        <DegradedStateView
          variant="error"
          label={t('degraded.error_label')}
          title={errorTitle}
          description={errorDescription}
          footer={<Button variant="secondary" size="sm" onClick={onRetry}>{t('modpacks.world_refresh')}</Button>}
        />
      ) : items.length === 0 ? (
        hasSearchFilters ? (
          <DegradedStateView
            variant="zero-results"
            label={t('degraded.zero_results_label')}
            title={t('modpacks.no_results')}
            description={t('modpacks.try_changing_filters')}
            footer={<Button variant="secondary" size="sm" onClick={onResetFilters}>{t('modpacks.clear_filters')}</Button>}
          />
        ) : (
          <DegradedStateView
            variant="empty"
            label={t('degraded.empty_label')}
            title={t('modpacks.no_modpacks_title')}
            description={t('modpacks.no_modpacks_desc')}
            footer={(
              <Button variant="secondary" size="sm" onClick={onBrowse}>
                <Compass className="h-4 w-4" />
                {t('modpacks.browser')}
              </Button>
            )}
          >
            <p className="text-center text-xs text-muted">{t('modpacks.drag_drop_hint')}</p>
          </DegradedStateView>
        )
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-3" role="list" aria-label={t('modpacks.title') || 'Modpacks'}>
          {items.map((item, index) => (
            <InstalledModpackCard
              key={item.id}
              item={item}
              update={availableUpdatesById[item.id]}
              index={index}
              selected={item.id === selectedId}
              onSelect={onSelect}
              onShowDetails={onShowDetails}
            />
          ))}
        </div>
      )}
    </>
  );
}
