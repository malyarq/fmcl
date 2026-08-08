import { memo, useMemo } from 'react';
import type { ProviderCatalogSearchResultItem } from '@shared/contracts';
import { FolderOpen, Star } from 'lucide-react';
import { useSettings } from '../../../contexts/SettingsContext';
import {
  DEFAULT_MODPACK_BROWSER_STATE,
  type ModpackBrowserState,
} from '../../../features/modpacks/hooks/useModpackNavigation';
import { cn } from '../../../utils/cn';
import { toDisplayErrorMessage } from '../../../utils/displayError';
import { DegradedStateView } from '../../layout/DegradedStateView';
import { Button } from '../../ui/Button';
import { LazyImage } from '../../ui/LazyImage';
import { LoadingSpinner } from '../../ui/LoadingSpinner';

type Translate = (key: string, params?: Record<string, string | number>) => string;

function identityOf(modpack: Pick<ProviderCatalogSearchResultItem, 'projectId' | 'platform'>): string {
  return `${modpack.platform}:${modpack.projectId}`;
}

function translateWithFallback(t: Translate, key: string, fallback: string): string {
  const value = t(key);
  return value === key ? fallback : value;
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

function resolveMinecraftVersion(
  modpack: ProviderCatalogSearchResultItem,
  activeFilter: ModpackBrowserState['filterMCVersion'],
): string | null {
  const explicitVersion = modpack.minecraftVersion?.trim();
  if (explicitVersion) return explicitVersion;
  return activeFilter === DEFAULT_MODPACK_BROWSER_STATE.filterMCVersion ? null : activeFilter;
}

interface ModpackBrowserCardProps {
  modpack: ProviderCatalogSearchResultItem;
  filterMCVersion: ModpackBrowserState['filterMCVersion'];
  favorite: boolean;
  opening: boolean;
  onToggleFavorite: (modpack: ProviderCatalogSearchResultItem) => void;
  onOpen: (modpack: ProviderCatalogSearchResultItem) => void;
}

const ModpackBrowserCard = memo(function ModpackBrowserCard({
  modpack,
  filterMCVersion,
  favorite,
  opening,
  onToggleFavorite,
  onOpen,
}: ModpackBrowserCardProps) {
  const { t, getAccentStyles, formatDate } = useSettings();
  const minecraftVersion = resolveMinecraftVersion(modpack, filterMCVersion);
  const updatedLabel = useMemo(
    () => formatDateLabel(modpack.dateModified ?? modpack.dateCreated, formatDate),
    [formatDate, modpack.dateCreated, modpack.dateModified],
  );
  const favoriteActionLabel = favorite
    ? translateWithFallback(t, 'modpacks.remove_favorite', 'Remove favorite')
    : translateWithFallback(t, 'modpacks.add_favorite', 'Add favorite');
  const favoriteBackground = getAccentStyles('soft-bg');
  const favoriteBorder = getAccentStyles('soft-border');
  const favoriteLabel = getAccentStyles('title');
  const primaryAccent = getAccentStyles('bg');

  return (
    <div
      role="listitem"
      aria-busy={opening}
      data-opening={opening ? 'true' : 'false'}
      className="surface-card relative flex min-h-[16rem] cursor-pointer flex-col p-4 transition-colors hover:border-border-active hover:bg-card focus-within:ring-2 focus-within:ring-[rgb(var(--accent-main))] focus-within:ring-offset-2 focus-within:ring-offset-background"
    >
      <button
        type="button"
        aria-label={modpack.title}
        onClick={() => onOpen(modpack)}
        className="absolute inset-0 z-10 rounded-lg focus:outline-none focus:ring-2 focus:ring-[rgb(var(--accent-main))] focus:ring-offset-2 focus:ring-offset-background"
      />
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onToggleFavorite(modpack);
        }}
        aria-pressed={favorite}
        aria-label={`${favoriteActionLabel}: ${modpack.title}`}
        data-state={favorite ? 'active' : 'inactive'}
        className={cn(
          'absolute right-2 top-2 z-30 rounded-full border p-1.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--accent-main))] focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          favorite
            ? cn('border-border/60 bg-card/90', favoriteBackground.className, favoriteBorder.className)
            : 'border-transparent hover:bg-background/70',
        )}
        style={favorite ? { ...favoriteBackground.style, ...favoriteBorder.style } : undefined}
        title={favoriteActionLabel}
      >
        <Star
          className={cn('h-5 w-5', favorite ? cn('fill-current', favoriteLabel.className) : 'text-muted')}
          style={favorite ? favoriteLabel.style : undefined}
        />
      </button>
      <div className="pointer-events-none relative z-20 flex h-full flex-col gap-4">
        <div className="flex gap-4">
          <LazyImage
            src={modpack.iconUrl ?? undefined}
            alt={modpack.title}
            className="h-16 w-16 rounded-2xl border border-border/70 object-cover"
          />
          <div className="min-w-0 flex-1">
            <h4 className="truncate pr-8 font-semibold text-foreground">{modpack.title}</h4>
          </div>
        </div>

        {(minecraftVersion || updatedLabel) && (
          <div className="flex flex-wrap gap-x-6 gap-y-3 text-xs text-secondary">
            {minecraftVersion && (
              <div className="min-w-[8rem]">
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                  {translateWithFallback(t, 'modpacks.minecraft_version', 'Minecraft Version')}
                </div>
                <div className="mt-1 text-sm font-medium text-foreground">{minecraftVersion}</div>
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
        )}

        <div className="pointer-events-auto relative z-30 mt-auto pt-1" onClick={(event) => event.stopPropagation()}>
          <Button
            variant="primary"
            size="sm"
            geometry="catalog-primary"
            onClick={() => onOpen(modpack)}
            className={cn('w-full justify-center', primaryAccent.className)}
            style={primaryAccent.style}
            aria-label={`${translateWithFallback(t, 'modpacks.open_details', 'Open details')}: ${modpack.title}`}
          >
            <FolderOpen className="h-4 w-4" />
            {translateWithFallback(t, 'modpacks.open_details', 'Open details')}
          </Button>
        </div>
      </div>
    </div>
  );
});

export interface ModpackBrowserResultsProps {
  showHistory: boolean;
  onShowBrowser: () => void;
  history: ProviderCatalogSearchResultItem[];
  onClearHistory: () => void;
  results: ProviderCatalogSearchResultItem[];
  loading: boolean;
  searchError: unknown | null;
  hasSearchFilters: boolean;
  onResetFilters: () => void;
  onRetrySearch: () => void;
  filterMCVersion: ModpackBrowserState['filterMCVersion'];
  isFavorite: (modpack: ProviderCatalogSearchResultItem) => boolean;
  onToggleFavorite: (modpack: ProviderCatalogSearchResultItem) => void;
  onOpenModpack: (modpack: ProviderCatalogSearchResultItem) => void;
  openingIdentity: string | null;
  currentPage: number;
  totalPages: number;
  totalResults: number;
  onPageChange: (page: number) => void;
}

export function ModpackBrowserResults({
  showHistory,
  onShowBrowser,
  history,
  onClearHistory,
  results,
  loading,
  searchError,
  hasSearchFilters,
  onResetFilters,
  onRetrySearch,
  filterMCVersion,
  isFavorite,
  onToggleFavorite,
  onOpenModpack,
  openingIdentity,
  currentPage,
  totalPages,
  totalResults,
  onPageChange,
}: ModpackBrowserResultsProps) {
  const { t, formatNumber } = useSettings();
  const errorTitle = t('error.inline_fallback');
  const errorDescription = searchError
    ? (() => {
      const detail = toDisplayErrorMessage(searchError, errorTitle);
      return detail !== errorTitle ? detail : t('modpacks.browser_desc');
    })()
    : '';
  const renderCard = (modpack: ProviderCatalogSearchResultItem) => (
    <ModpackBrowserCard
      key={identityOf(modpack)}
      modpack={modpack}
      filterMCVersion={filterMCVersion}
      favorite={isFavorite(modpack)}
      opening={openingIdentity === identityOf(modpack)}
      onToggleFavorite={onToggleFavorite}
      onOpen={onOpenModpack}
    />
  );

  if (showHistory) {
    return (
      <div className="space-y-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-medium text-foreground">
            {t('modpacks.history') || 'История'} ({formatNumber(history.length)})
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" onClick={onShowBrowser}>
              {t('modpacks.browser') || 'Браузер модпаков'}
            </Button>
            {history.length > 0 && (
              <Button variant="danger" size="sm" onClick={onClearHistory}>
                {t('modpacks.clear_history') || 'Очистить историю'}
              </Button>
            )}
          </div>
        </div>
        {history.length === 0 ? (
          <div className="surface-muted py-12 text-center text-secondary">
            {t('modpacks.no_history') || 'История просмотров пуста'}
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,19rem),22rem))] justify-center gap-4" role="list" aria-label={t('modpacks.history') || 'Viewed modpacks'}>
            {history.map(renderCard)}
          </div>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12" role="status">
        <LoadingSpinner size="lg" />
        <p className="text-sm text-secondary">{t('modpacks.loading')}</p>
      </div>
    );
  }

  if (results.length === 0) {
    if (searchError) {
      return (
        <DegradedStateView
          variant="error"
          label={t('degraded.error_label')}
          title={errorTitle}
          description={errorDescription}
          footer={<Button variant="secondary" size="sm" onClick={onRetrySearch}>{t('modpacks.search_btn')}</Button>}
        />
      );
    }
    if (hasSearchFilters) {
      return (
        <DegradedStateView
          variant="zero-results"
          label={t('degraded.zero_results_label')}
          title={t('modpacks.no_results')}
          description={t('modpacks.try_changing_filters')}
          footer={<Button variant="secondary" size="sm" onClick={onResetFilters}>{t('modpacks.clear_filters')}</Button>}
        />
      );
    }
    return (
      <DegradedStateView
        variant="empty"
        label={t('degraded.empty_label')}
        title={t('modpacks.results_summary_empty')}
        description={t('modpacks.browser_desc')}
      />
    );
  }

  return (
    <div>
      <div className="mb-4 grid grid-cols-[repeat(auto-fit,minmax(min(100%,19rem),22rem))] justify-center gap-4" role="list" aria-label={t('modpacks.browser') || 'Modpack results'}>
        {results.map(renderCard)}
      </div>
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
          >
            {t('modpacks.prev') || 'Назад'}
          </Button>
          <span className="text-sm text-secondary">
            {t('modpacks.page') || 'Страница'} {formatNumber(currentPage)} {t('modpacks.of') || 'из'} {formatNumber(Math.max(totalPages, 1))} ({formatNumber(totalResults)} {t('modpacks.total') || 'всего'})
          </span>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
          >
            {t('modpacks.next') || 'Вперед'}
          </Button>
        </div>
      )}
    </div>
  );
}
