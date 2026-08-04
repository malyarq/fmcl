import { useEffect, useMemo, useRef } from 'react';
import { Button } from '../../../components/ui/Button';
import { LazyImage } from '../../../components/ui/LazyImage';
import { Select } from '../../../components/ui/Select';
import { useSettings } from '../../../contexts/SettingsContext';
import { MINECRAFT_VERSIONS } from '../../../utils/minecraftVersionsList';
import {
  createRendererResourcePackContentAcquisitionAdapter,
  type ResourcePackContentAcquisitionItem,
  type ResourcePackContentAcquisitionSelection,
  type ResourcePackContentRuntime,
} from '../adapters/resourcePackContentAcquisitionAdapter';
import type { AcquisitionOutcome } from '../contentAcquisitionTypes';
import { useContentAcquisitionState } from '../hooks/useContentAcquisitionState';
import {
  ContentAcquisitionSurface,
  type ContentAcquisitionSurfaceTestIds,
} from './ContentAcquisitionSurface';

export type ResourcePackContentAcquisitionProps = {
  runtime: ResourcePackContentRuntime;
  onCancel: () => void;
  onCommitted?: (outcome: AcquisitionOutcome) => void | Promise<void>;
  onSuccess: (outcome: AcquisitionOutcome) => void;
  onBusyChange?: (busy: boolean) => void;
  testIds?: ContentAcquisitionSurfaceTestIds;
  className?: string;
  resultsClassName?: string;
  actionsClassName?: string;
};

export function ResourcePackContentAcquisition({
  runtime,
  onCancel,
  onCommitted,
  onSuccess,
  onBusyChange,
  testIds,
  className,
  resultsClassName,
  actionsClassName,
}: ResourcePackContentAcquisitionProps) {
  const { t, formatNumber } = useSettings();
  const formatCount = typeof formatNumber === 'function'
    ? formatNumber
    : (value: number) => new Intl.NumberFormat('en-US').format(value);
  const adapter = useMemo(
    () => createRendererResourcePackContentAcquisitionAdapter(onCommitted),
    [onCommitted],
  );
  const state = useContentAcquisitionState({
    adapter,
    runtime,
    debounceMs: 500,
    initialFilters: {
      platform: 'modrinth',
      minecraftVersion: runtime.minecraftVersion ?? '',
      sort: 'popularity',
    },
  });
  const presentedOutcomeRef = useRef<AcquisitionOutcome | null>(null);
  const selectedCount = state.selections.size;
  const busy = state.isInstalling || state.isImportingLocal || state.resolvingIds.size > 0;
  const committedCount = state.outcome?.committedSelectionIds.length ?? 0;

  useEffect(() => {
    onBusyChange?.(busy);
    return () => onBusyChange?.(false);
  }, [busy, onBusyChange]);

  useEffect(() => {
    const outcome = state.outcome;
    if (!outcome?.isPresentationSuccess || presentedOutcomeRef.current === outcome) return;
    presentedOutcomeRef.current = outcome;
    onSuccess(outcome);
  }, [onSuccess, state.outcome]);

  const emptyIsFiltered = Boolean(state.query.trim());
  const labels = {
    search: t('modpacks.search_btn') || 'Search',
    searchPlaceholder: t('modpacks.search_resourcepack_placeholder') || 'Search resource packs...',
    loading: t('modpacks.loading') || 'Loading...',
    empty: emptyIsFiltered
      ? (t('modpacks.no_resourcepack_results') || 'No resource packs matched the current filters')
      : (t('modpacks.add_resourcepack_empty_title') || 'Browse resource packs'),
    emptyDescription: emptyIsFiltered
      ? (t('modpacks.resourcepack_filter_hint') || 'Try a broader query, adjust filters, or import a local .zip below.')
      : (t('modpacks.add_resourcepack_empty_desc') || 'Search Modrinth or import a local .zip to add a resource pack to this modpack.'),
    error: t('modpacks.add_mod_search_error_title') || 'Unable to search right now',
    errorDescription: t('modpacks.add_mod_search_error_desc') || 'We could not load catalog results right now.',
    retry: t('operations.retry') || 'Retry',
    loadMore: t('modpacks.load_more') || 'Load more',
    install: selectedCount > 0
      ? `${t('modpacks.add_selected_resourcepacks') || 'Add selected resource packs'} (${selectedCount})`
      : (t('modpacks.add_resourcepack') || 'Add Resource Pack'),
    installing: t('modpacks.installing') || 'Installing...',
    localImport: t('modpacks.guided_local_fallback_action') || 'Import local .zip',
    selected: t('modpacks.selected') || 'selected',
    partial: committedCount > 0
      ? (t('modpacks.resourcepack_recovery_partial_intro')
        || 'Added {{added}} resource packs. The remaining issues stayed on this screen.')
        .replace('{{added}}', String(committedCount))
      : (t('modpacks.resourcepack_recovery_failed_title')
        || 'Some resource packs still need attention. Retry from this screen or keep browsing.'),
    success: t('modpacks.resourcepack_add_success') || 'Resource packs added to this modpack.',
    issueMessages: {
      duplicate: t('modpacks.resourcepack_issue_duplicate')
        || 'Already in this modpack. Review installed resource packs or choose a different pack.',
      'invalid-archive': t('modpacks.resourcepack_issue_invalid_archive')
        || 'FMCL could not treat this file as a valid resource pack. Try another version or another local .zip.',
      'runtime-blocked': t('modpacks.resourcepack_issue_runtime_blocked')
        || 'The current Minecraft runtime blocks this resource pack.',
      'install-failure': t('modpacks.resourcepack_issue_install_failure')
        || 'FMCL could not add this resource pack right now. Retry from this screen or keep browsing.',
      'manifest-failure': t('modpacks.resourcepack_issue_manifest_failure')
        || 'FMCL could not finish this resource-pack install.',
      unknown: t('modpacks.resourcepack_recovery_refresh_failure')
        || 'The files were added, but the canonical instance view could not be refreshed.',
    },
  };

  return (
    <ContentAcquisitionSurface
      state={state}
      labels={labels}
      testIds={testIds}
      className={className}
      resultsClassName={resultsClassName}
      actionsClassName={actionsClassName}
      controls={(
        <div className="space-y-4">
          <section
            className="surface-inline space-y-2 rounded-2xl border border-border/70 bg-card/72 p-4"
            data-testid="guided-content-resourcepack-scope"
          >
            <div className="kicker-label">{t('modpacks.tab_resourcepacks') || 'Resource packs'}</div>
            <h3 className="text-sm font-semibold text-foreground">
              {t('modpacks.resourcepack_scope_title') || 'Instance-scoped resource packs'}
            </h3>
            <p className="text-sm text-secondary">
              {t('modpacks.resourcepack_scope_desc')
                || 'Resource packs added here only affect this modpack. FMCL does not mark them compatible or incompatible for you.'}
            </p>
          </section>

          <div className="surface-card space-y-3 p-4" data-testid="add-mod-workspace-controls">
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" disabled>
                {t('modpacks.platform_curseforge')} ({t('modpacks.coming_soon_short') || 'Soon'})
              </Button>
              <Button variant="secondary" size="sm" aria-pressed>
                {t('modpacks.platform_modrinth')}
              </Button>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Select
                aria-label={t('modpacks.minecraft_version') || 'Minecraft version'}
                value={state.filters.minecraftVersion ?? ''}
                onChange={(event) => state.setFilter('minecraftVersion', event.target.value)}
              >
                <option value="">{t('modpacks.filter_all') || 'All Minecraft versions'}</option>
                {MINECRAFT_VERSIONS.filter((version) => version.type === 'release').map((version) => (
                  <option key={version.id} value={version.id}>{version.id}</option>
                ))}
              </Select>
              <Select
                aria-label={t('modpacks.sort') || 'Sort'}
                value={state.filters.sort ?? 'popularity'}
                onChange={(event) => state.setFilter('sort', event.target.value)}
              >
                <option value="popularity">{t('modpacks.sort_popularity') || 'Popularity'}</option>
                <option value="date">{t('modpacks.sort_date') || 'Date'}</option>
                <option value="alphabetical">{t('modpacks.sort_alphabetical') || 'Alphabetical'}</option>
              </Select>
            </div>
            {typeof state.total === 'number' && state.total > 0 ? (
              <p className="text-xs text-secondary">
                {formatCount(state.total)} {t('modpacks.results') || 'results'}
              </p>
            ) : null}
          </div>

          <section
            className="surface-inline space-y-2 rounded-2xl border border-dashed border-border/70 bg-background/60 p-4"
            data-testid="guided-content-local-fallback"
          >
            <div className="kicker-label">
              {t('modpacks.guided_local_fallback_label') || 'Local .zip fallback'}
            </div>
            <h3 className="text-sm font-semibold text-foreground">
              {t('modpacks.resourcepack_local_fallback_title') || 'Have a local resource pack .zip already?'}
            </h3>
            <p className="text-sm text-secondary">
              {t('modpacks.resourcepack_local_fallback_desc')
                || 'Import it straight into this modpack when browsing is not the right fit. This only affects the current instance.'}
            </p>
          </section>
        </div>
      )}
      renderItem={(item, selection) => (
        <ResourcePackResult item={item} selection={selection} formatNumber={formatCount} t={t} />
      )}
      secondaryAction={(
        <Button variant="secondary" onClick={onCancel} disabled={busy}>
          {t('general.cancel')}
        </Button>
      )}
    />
  );
}

function ResourcePackResult({
  item,
  selection,
  formatNumber,
  t,
}: {
  item: ResourcePackContentAcquisitionItem;
  selection: ResourcePackContentAcquisitionSelection | undefined;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  t: (key: string) => string;
}) {
  return (
    <span className="flex min-w-0 flex-1 items-start gap-3">
      <LazyImage
        src={item.iconUrl}
        alt=""
        className="h-12 w-12 shrink-0 rounded-xl border border-border/70 object-cover"
      />
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-foreground">{item.label}</span>
        {selection ? (
          <span className="mt-1 block text-xs text-secondary">
            {selection.versionLabel}
            {selection.minecraftVersions?.[0] ? ` (${selection.minecraftVersions[0]})` : ''}
          </span>
        ) : item.description ? (
          <span className="mt-1 line-clamp-2 block text-sm text-secondary">{item.description}</span>
        ) : null}
        {typeof item.downloads === 'number' ? (
          <span className="mt-1 block text-xs text-secondary">
            {t('modpacks.downloads')}: {formatNumber(item.downloads)}
          </span>
        ) : null}
      </span>
    </span>
  );
}
