import { useEffect, useMemo, useRef } from 'react';
import { Button } from '../../../components/ui/Button';
import { LazyImage } from '../../../components/ui/LazyImage';
import { Select } from '../../../components/ui/Select';
import { useSettings } from '../../../contexts/SettingsContext';
import { MINECRAFT_VERSIONS } from '../../../utils/minecraftVersionsList';
import {
  createRendererModContentAcquisitionAdapter,
  type ModContentAcquisitionItem,
  type ModContentAcquisitionSelection,
  type ModContentRuntime,
} from '../adapters/modContentAcquisitionAdapter';
import type { AcquisitionOutcome } from '../contentAcquisitionTypes';
import { useContentAcquisitionState } from '../hooks/useContentAcquisitionState';
import {
  ContentAcquisitionSurface,
  type ContentAcquisitionSurfaceTestIds,
} from './ContentAcquisitionSurface';

export type ModContentAcquisitionProps = {
  runtime: ModContentRuntime;
  onCancel: () => void;
  onCommitted?: (outcome: AcquisitionOutcome) => void | Promise<void>;
  onSuccess: (outcome: AcquisitionOutcome) => void;
  onBusyChange?: (busy: boolean) => void;
  testIds?: ContentAcquisitionSurfaceTestIds;
  className?: string;
  resultsClassName?: string;
  actionsClassName?: string;
};

export function ModContentAcquisition({
  runtime,
  onCancel,
  onCommitted,
  onSuccess,
  onBusyChange,
  testIds,
  className,
  resultsClassName,
  actionsClassName,
}: ModContentAcquisitionProps) {
  const { t, formatNumber } = useSettings();
  const formatCount = typeof formatNumber === 'function'
    ? formatNumber
    : (value: number) => new Intl.NumberFormat('en-US').format(value);
  const adapter = useMemo(
    () => createRendererModContentAcquisitionAdapter(onCommitted),
    [onCommitted],
  );
  const state = useContentAcquisitionState({
    adapter,
    runtime,
    debounceMs: 500,
    initialFilters: {
      platform: 'modrinth',
      minecraftVersion: runtime.minecraftVersion ?? '',
      loader: runtime.loader ?? '',
      sort: 'popularity',
    },
  });
  const presentedOutcomeRef = useRef<AcquisitionOutcome | null>(null);
  const selectedCount = state.selections.size;
  const busy = state.isInstalling || state.resolvingIds.size > 0;

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

  const labels = {
    search: t('modpacks.search_btn') || 'Search',
    searchPlaceholder: t('modpacks.search_mod_placeholder') || 'Search mods...',
    loading: t('modpacks.loading') || 'Loading...',
    empty: state.query.trim()
      ? (t('modpacks.no_mod_results') || 'No mods found for the current filters')
      : (t('modpacks.add_mod_empty_title') || 'Search the catalog'),
    error: t('modpacks.add_mod_search_error_title') || 'Unable to search right now',
    errorDescription: t('modpacks.add_mod_search_error_desc') || 'We could not load catalog results right now.',
    retry: t('operations.retry') || 'Retry',
    loadMore: t('modpacks.load_more') || 'Load more',
    install: selectedCount > 0
      ? `${t('modpacks.add_selected') || 'Add selected'} (${selectedCount})`
      : (t('modpacks.add_mod') || 'Add'),
    installing: t('modpacks.installing') || 'Installing...',
    localImport: '',
    selected: t('modpacks.selected') || 'selected',
    partial: t('modpacks.add_mod_partial_title') || 'Some mods still need attention',
    success: t('modpacks.add_mod_success') || 'Mods added',
    issueMessages: {
      duplicate: t('modpacks.mod_issue_duplicate') || 'This file is already installed.',
      'invalid-archive': t('modpacks.mod_issue_invalid_archive') || 'The downloaded archive is invalid.',
      'runtime-blocked': t('modpacks.mod_issue_runtime_blocked') || 'The current runtime blocks this version.',
      'install-failure': t('modpacks.mod_issue_install_failure') || 'The file could not be downloaded or installed.',
      'manifest-failure': t('modpacks.mod_issue_manifest_failure') || 'The file was installed, but its manifest entry could not be saved.',
      unknown: t('modpacks.mod_issue_unknown') || 'The installation committed, but the catalog could not be refreshed.',
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
        <div className="surface-card space-y-3 p-4" data-testid="add-mod-workspace-controls">
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" disabled>
              {t('modpacks.platform_curseforge')} ({t('modpacks.coming_soon_short') || 'Soon'})
            </Button>
            <Button variant="secondary" size="sm" aria-pressed>
              {t('modpacks.platform_modrinth')}
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
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
              aria-label={t('general.modloader') || 'Modloader'}
              value={state.filters.loader ?? ''}
              onChange={(event) => state.setFilter('loader', event.target.value)}
            >
              <option value="">{t('modpacks.filter_all_loaders') || 'All Modloaders'}</option>
              <option value="forge">Forge</option>
              <option value="fabric">Fabric</option>
              <option value="neoforge">NeoForge</option>
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
      )}
      renderItem={(item, selection) => (
        <ModResult item={item} selection={selection} formatNumber={formatCount} t={t} />
      )}
      secondaryAction={(
        <Button variant="secondary" onClick={onCancel} disabled={busy}>
          {t('general.cancel')}
        </Button>
      )}
    />
  );
}

function ModResult({
  item,
  selection,
  formatNumber,
  t,
}: {
  item: ModContentAcquisitionItem;
  selection: ModContentAcquisitionSelection | undefined;
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
