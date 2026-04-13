import React from 'react';
import { ExternalLink, Filter, PackagePlus, RefreshCw, Trash2 } from 'lucide-react';
import { Virtuoso } from 'react-virtuoso';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
import { LoadingSpinner } from '../../ui/LoadingSpinner';
import { Select } from '../../ui/Select';
import { cn } from '../../../utils/cn';
import { modNameToSlug } from '../../../utils/modSlug';
import type { ModEntry } from '@shared/types/mods';
import { isVersionCompatible } from '../../../utils/versionCheck';
import { externalLinksIPC } from '../../../services/ipc/externalLinksIPC';

export type ModpackModEntry = ModEntry;

export interface ModpackDetailsModsTabProps {
  mods: ModpackModEntry[];
  loadingMods: boolean;
  modSearchQuery: string;
  onModSearchQueryChange: (value: string) => void;
  modFilterStatus: 'all' | 'enabled' | 'disabled';
  onModFilterStatusChange: (value: 'all' | 'enabled' | 'disabled') => void;
  onAddMod: () => void;
  onRemoveMod: (mod: ModpackModEntry) => Promise<void>;
  onModToggle?: (mod: ModpackModEntry) => void;
  onRefresh?: () => void;
  t: (key: string) => string;
  getAccentStyles: (type: 'bg' | 'text' | 'border' | 'ring' | 'hover' | 'accent' | 'title' | 'soft-bg' | 'soft-border') => {
    className?: string;
    style?: React.CSSProperties;
  };
}

export const ModpackDetailsModsTab: React.FC<ModpackDetailsModsTabProps> = ({
  mods,
  loadingMods,
  modSearchQuery,
  onModSearchQueryChange,
  modFilterStatus,
  onModFilterStatusChange,
  onAddMod,
  onRemoveMod,
  onModToggle,
  onRefresh,
  t,
}) => {
  const [expandedModId, setExpandedModId] = React.useState<string | null>(null);

  const toggleExpand = React.useCallback((modId: string) => {
    setExpandedModId((prev) => (prev === modId ? null : modId));
  }, []);

  const getDependencyStatus = React.useCallback(
    (depId: string, versionRange?: string | string[]) => {
      const installed = mods.find((mod) => mod.id === depId);
      if (!installed) return 'missing';
      if (!isVersionCompatible(installed.version, versionRange)) return 'incompatible';
      return 'installed';
    },
    [mods]
  );

  const handleOpenExternalLink = React.useCallback((url: string, context: string) => {
    void externalLinksIPC.open({ url, context }).catch((error) => {
      console.error('Failed to open external link:', error);
    });
  }, []);

  const filteredMods = React.useMemo(() => {
    return mods.filter((mod) => {
      const matchesSearch =
        modSearchQuery.trim() === '' ||
        mod.name.toLowerCase().includes(modSearchQuery.toLowerCase()) ||
        mod.file.name.toLowerCase().includes(modSearchQuery.toLowerCase());
      const matchesFilter =
        modFilterStatus === 'all' ||
        (modFilterStatus === 'enabled' && mod.enabled) ||
        (modFilterStatus === 'disabled' && !mod.enabled);
      return matchesSearch && matchesFilter;
    });
  }, [mods, modSearchQuery, modFilterStatus]);

  const enabledCount = React.useMemo(() => mods.filter((mod) => mod.enabled).length, [mods]);

  return (
    <div className="space-y-4">
      <div className="surface-card space-y-4 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="kicker-label">{t('modpacks.tab_mods')}</div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">
                {t('modpacks.installed_mods')} {!loadingMods && <span className="text-secondary">({mods.length})</span>}
              </h3>
              <p className="text-sm text-secondary">{t('modpacks.mods_description')}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" size="sm" onClick={onAddMod}>
              <PackagePlus className="h-4 w-4" />
              {t('modpacks.add_mod_btn')}
            </Button>
            <Button onClick={onRefresh} variant="secondary" size="sm" disabled={loadingMods}>
              <RefreshCw className="h-4 w-4" />
              {t('modpacks.update')}
            </Button>
          </div>
        </div>

        <div className="surface-inline flex flex-wrap items-center gap-3 p-3 text-sm text-secondary">
          <Filter className="h-4 w-4" />
          <span>{t('modpacks.mods_manage_hint')}</span>
          <span className="text-foreground">
            {enabledCount} {t('modpacks.enabled').toLowerCase()} / {mods.length}
          </span>
        </div>
      </div>

      <div className="surface-card grid gap-4 p-4 lg:grid-cols-[1fr_15rem]">
        <Input
          label={t('modpacks.search_mods')}
          placeholder={t('modpacks.search_mods')}
          value={modSearchQuery}
          onChange={(event) => onModSearchQueryChange(event.target.value)}
          className="w-full"
        />
        <Select
          label={t('modpacks.filter_all_items')}
          value={modFilterStatus}
          onChange={(event) => onModFilterStatusChange(event.target.value as 'all' | 'enabled' | 'disabled')}
          className="w-full"
        >
          <option value="all">{t('modpacks.filter_all_items')}</option>
          <option value="enabled">{t('modpacks.filter_enabled')}</option>
          <option value="disabled">{t('modpacks.filter_disabled')}</option>
        </Select>
      </div>

      {loadingMods ? (
        <div className="surface-inline flex items-center justify-center gap-3 p-6 text-sm text-secondary" role="status">
          <LoadingSpinner size="sm" variant="accent" />
          {t('modpacks.loading')}
        </div>
      ) : mods.length === 0 ? (
        <div className="surface-muted flex flex-col items-center gap-2 p-8 text-center">
          <p className="text-base font-semibold text-foreground">{t('modpacks.no_mods')}</p>
          <p className="max-w-xl text-sm text-secondary">{t('modpacks.mods_empty_hint')}</p>
        </div>
      ) : filteredMods.length === 0 ? (
        <div className="surface-muted flex flex-col items-center gap-2 p-8 text-center">
          <p className="text-base font-semibold text-foreground">{t('modpacks.no_matching_mods')}</p>
          <p className="max-w-xl text-sm text-secondary">{t('modpacks.mods_filter_hint')}</p>
        </div>
      ) : (
        <div className="surface-card h-[800px] overflow-hidden p-2">
          <Virtuoso
            style={{ height: '100%' }}
            data={filteredMods}
            itemContent={(_index, mod) => (
              <ModItem
                mod={mod}
                isExpanded={expandedModId === mod.id}
                toggleExpand={toggleExpand}
                onModToggle={onModToggle}
                onRemoveMod={onRemoveMod}
                onOpenExternalLink={handleOpenExternalLink}
                getDependencyStatus={getDependencyStatus}
                t={t}
              />
            )}
          />
        </div>
      )}
    </div>
  );
};

const ModItem = React.memo<{
  mod: ModpackModEntry;
  isExpanded: boolean;
  toggleExpand: (id: string) => void;
  onModToggle?: (mod: ModpackModEntry) => void;
  onRemoveMod: (mod: ModpackModEntry) => Promise<void>;
  onOpenExternalLink: (url: string, context: string) => void;
  getDependencyStatus: (id: string, range?: string | string[]) => string;
  t: (key: string) => string;
}>(({ mod, isExpanded, toggleExpand, onModToggle, onRemoveMod, onOpenExternalLink, getDependencyStatus, t }) => {
  return (
    <div className={cn('mb-2 rounded-2xl border border-border/70 bg-card/86 p-4 shadow-[0_12px_32px_rgba(0,0,0,0.12)]', !mod.enabled && 'opacity-75')}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <button
          type="button"
          className="min-w-0 flex-1 rounded-2xl text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--accent-main))] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          onClick={() => toggleExpand(mod.id)}
          aria-expanded={isExpanded}
        >
          <div className="flex flex-wrap items-center gap-2">
            <h5 className="truncate text-base font-semibold text-foreground">{mod.name}</h5>
            <span className="rounded-full border border-border/70 bg-background/70 px-2 py-0.5 text-xs font-medium text-secondary">
              {t('modpacks.version')}: {mod.version}
            </span>
            {mod.deps.length > 0 && (
              <span
                className={cn(
                  'rounded-full border px-2 py-0.5 text-xs font-medium',
                  mod.deps.some(
                    (dep) =>
                      dep.kind === 'depends' &&
                      (getDependencyStatus(dep.id, dep.versionRange) === 'missing' ||
                        getDependencyStatus(dep.id, dep.versionRange) === 'incompatible')
                  )
                    ? 'border-red-500/30 bg-red-500/10 text-red-400'
                    : 'border-border/70 bg-background/70 text-secondary'
                )}
              >
                {mod.deps.length} {t('modpacks.deps_title')}
              </span>
            )}
            {mod.loaders.length > 0 && (
              <span className="rounded-full border border-border/70 bg-background/70 px-2 py-0.5 text-xs font-medium text-secondary">
                {mod.loaders.join(', ')}
              </span>
            )}
          </div>

          <p className="mt-2 truncate text-sm text-secondary">{mod.file.name}</p>
        </button>

        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          <Button
            variant={mod.enabled ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => onModToggle?.(mod)}
          >
            {mod.enabled ? t('general.disable') : t('general.enable')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
            onClick={() => void onRemoveMod(mod)}
            aria-label={`${t('modpacks.remove_mod_title')}: ${mod.name}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="justify-start"
          onClick={() =>
            onOpenExternalLink(
              `https://modrinth.com/mod/${modNameToSlug(mod.name)}`,
              `${mod.name} on Modrinth`,
            )
          }
        >
          <ExternalLink className="h-4 w-4" />
          {t('modpacks.open_modrinth')}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="justify-start"
          onClick={() =>
            onOpenExternalLink(
              `https://www.curseforge.com/minecraft/mc-mods/${modNameToSlug(mod.name)}`,
              `${mod.name} on CurseForge`,
            )
          }
        >
          <ExternalLink className="h-4 w-4" />
          {t('modpacks.open_curseforge')}
        </Button>
      </div>

      {isExpanded && mod.deps.length > 0 && (
        <div className="surface-muted mt-4 space-y-2 p-3 text-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">{t('modpacks.deps_title')}</p>
          <div className="space-y-2">
            {mod.deps.map((dep, index) => {
              const status = getDependencyStatus(dep.id, dep.versionRange);
              const isMissing = status === 'missing' && dep.kind === 'depends';
              const isIncompatible = status === 'incompatible';

              return (
                <div key={`${dep.id}-${index}`} className="surface-inline flex flex-wrap items-center gap-2 p-3 text-xs">
                  <span
                    className={cn(
                      'h-2 w-2 rounded-full',
                      isMissing ? 'bg-red-500' : isIncompatible ? 'bg-yellow-500' : 'bg-emerald-500'
                    )}
                  />
                  <span className="font-mono text-foreground">{dep.id}</span>
                  {dep.versionRange && <span className="text-secondary">({String(dep.versionRange)})</span>}
                  <span className="rounded-full border border-border/70 bg-background/70 px-2 py-0.5 text-[10px] uppercase text-secondary">
                    {dep.kind}
                  </span>
                  {isMissing && <span className="ml-auto font-medium text-red-400">{t('modpacks.dep_missing')}</span>}
                  {isIncompatible && (
                    <span className="ml-auto font-medium text-yellow-400">{t('modpacks.dep_incompatible')}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
});
