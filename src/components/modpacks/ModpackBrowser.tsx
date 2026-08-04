import type {
  ProviderCatalogSearchResultItem,
  ProviderCatalogVersionDescriptor,
} from '@shared/contracts';
import { ArrowLeft } from 'lucide-react';
import { useSettings } from '../../contexts/SettingsContext';
import type { ModpackBrowserState } from '../../features/modpacks/hooks/useModpackNavigation';
import { Button } from '../ui/Button';
import { ModpackBrowserFilters } from './browser/ModpackBrowserFilters';
import { ModpackBrowserResults } from './browser/ModpackBrowserResults';
import { useModpackBrowserCatalog } from './browser/useModpackBrowserCatalog';

export interface ModpackBrowserProps {
  initialState: ModpackBrowserState;
  onBack: () => void;
  onNavigate: (view: {
    type: 'install';
    modpack: ProviderCatalogSearchResultItem;
    versions: ProviderCatalogVersionDescriptor[];
    platform: 'curseforge' | 'modrinth';
  }) => void;
  onStateChange: (state: ModpackBrowserState) => void;
}

export function ModpackBrowser({ initialState, onBack, onNavigate, onStateChange }: ModpackBrowserProps) {
  const { t } = useSettings();
  const catalog = useModpackBrowserCatalog({ initialState, onNavigate, onStateChange });

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="border-b border-border/70 bg-card/78 px-6 py-3 backdrop-blur-md">
        <Button variant="secondary" size="sm" onClick={onBack} className="inline-flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" />
          {t('general.back') || 'Назад'}
        </Button>
      </div>

      <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto p-6">
        {!catalog.showHistory && (
          <ModpackBrowserFilters
            query={catalog.query}
            onQueryChange={catalog.setQuery}
            sortBy={catalog.sortBy}
            onSortByChange={catalog.setSortBy}
            filterMCVersion={catalog.filterMCVersion}
            onFilterMCVersionChange={catalog.setFilterMCVersion}
            filterLoader={catalog.filterLoader}
            onFilterLoaderChange={catalog.setFilterLoader}
            itemsPerPage={catalog.itemsPerPage}
            onItemsPerPageChange={catalog.setItemsPerPage}
            hasActiveFilters={catalog.hasActiveFilters}
            onResetFilters={catalog.resetFilters}
            recentHistory={catalog.recentHistory}
            onOpenHistory={() => catalog.setShowHistory(true)}
            onOpenModpack={(modpack) => void catalog.openModpack(modpack)}
          />
        )}

        <ModpackBrowserResults
          showHistory={catalog.showHistory}
          onShowBrowser={() => catalog.setShowHistory(false)}
          history={catalog.history}
          onClearHistory={catalog.clearHistory}
          results={catalog.results}
          loading={catalog.loading}
          searchError={catalog.searchError}
          hasSearchFilters={catalog.hasSearchFilters}
          onResetFilters={catalog.resetFilters}
          onRetrySearch={() => void catalog.retrySearch()}
          filterMCVersion={catalog.filterMCVersion}
          isFavorite={catalog.isFavorite}
          onToggleFavorite={catalog.toggleFavorite}
          onOpenModpack={(modpack) => void catalog.openModpack(modpack)}
          openingIdentity={catalog.openingIdentity}
          currentPage={catalog.currentPage}
          totalPages={catalog.totalPages}
          totalResults={catalog.totalResults}
          onPageChange={catalog.setCurrentPage}
        />
      </div>
    </div>
  );
}
