import React from 'react';
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
  getAccentStyles,
}) => {
  const [expandedModId, setExpandedModId] = React.useState<string | null>(null);

  const toggleExpand = React.useCallback((modId: string) => {
    setExpandedModId(prev => prev === modId ? null : modId);
  }, []);

  const getDependencyStatus = React.useCallback((depId: string, versionRange?: string | string[]) => {
    const installed = mods.find(m => m.id === depId);
    if (!installed) return 'missing';
    if (!isVersionCompatible(installed.version, versionRange)) return 'incompatible';
    return 'installed';
  }, [mods]);

  const handleOpenExternalLink = React.useCallback((url: string, context: string) => {
    void externalLinksIPC.open({ url, context }).catch((error) => {
      console.error('Failed to open external link:', error)
    })
  }, [])


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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold dark:text-gray-200">
          {t('modpacks.installed_mods') || 'Installed Mods'} {!loadingMods && `(${mods.length})`}
        </h3>
        <div className="flex gap-2">
          <Button variant="primary" size="sm" onClick={onAddMod} style={getAccentStyles('bg').style}>
            {t('modpacks.add_mod_btn') || '+ Add Mod'}
          </Button>
          <Button onClick={onRefresh} variant="secondary" size="sm" disabled={loadingMods}>
            {t('modpacks.update') || 'Refresh'}
          </Button>
        </div>
      </div>

      <div className="flex gap-2">
        <div className="flex-1">
          <Input
            placeholder={t('modpacks.search_mods') || 'Search mods...'}
            value={modSearchQuery}
            onChange={(e) => onModSearchQueryChange(e.target.value)}
            className="w-full"
          />
        </div>
        <div className="w-[8rem] shrink-0">
          <Select
            value={modFilterStatus}
            onChange={(e) => onModFilterStatusChange(e.target.value as 'all' | 'enabled' | 'disabled')}
            className="w-full"
          >
            <option value="all">{t('modpacks.filter_all_items') || 'All'}</option>
            <option value="enabled">{t('modpacks.filter_enabled') || 'Enabled'}</option>
            <option value="disabled">{t('modpacks.filter_disabled') || 'Disabled'}</option>
          </Select>
        </div>
      </div>

      {loadingMods ? (
        <div className="flex flex-col items-center justify-center py-8 gap-3">
          <LoadingSpinner size="md" />
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{t('modpacks.loading')}</p>
        </div>
      ) : mods.length === 0 ? (
        <div className="py-12 text-center text-gray-500 dark:text-gray-400 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700">
          <p className="mb-4">{t('modpacks.no_mods') || 'No mods installed'}</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="text-sm text-zinc-600 dark:text-zinc-400">
            {t('modpacks.mods_stats') || 'Total'}: {mods.length} / {t('modpacks.enabled') || 'Enabled'}:{' '}
            {mods.filter((m) => m.enabled).length}
          </div>
          <div className="h-[800px] border rounded-lg overflow-hidden">
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
        </div>
      )}
    </div>
  );
};

// Extracted ModItem component with React.memo
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
    <div
      className={cn(
        'mb-2 mx-1 mt-1 rounded-lg border transition-all overflow-hidden',
        mod.enabled
          ? 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 shadow-sm'
          : 'bg-gray-50 dark:bg-zinc-900/50 border-transparent opacity-70 hover:opacity-100'
      )}
    >
      <div className="p-3">
        <div className="flex items-center gap-4">
          <div
            className="flex-1 min-w-0 cursor-pointer"
            onClick={() => toggleExpand(mod.id)}
          >
            <div className="flex items-center gap-2">
              <h5
                className={cn(
                  'font-medium truncate',
                  mod.enabled ? 'text-zinc-900 dark:text-white' : 'text-zinc-500 dark:text-zinc-400'
                )}
              >
                {mod.name}
              </h5>
              {mod.deps && mod.deps.length > 0 && (
                <span className={cn(
                  "text-[10px] px-1.5 py-0.5 rounded-full border",
                  mod.deps.some(d => d.kind === 'depends' && (getDependencyStatus(d.id, d.versionRange) === 'missing' || getDependencyStatus(d.id, d.versionRange) === 'incompatible'))
                    ? "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800"
                    : "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700"
                )}>
                  {mod.deps.length} {t('modpacks.deps_title') || 'deps'}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                {t('modpacks.version')}: {mod.version}
              </span>
              {mod.loaders.length > 0 && (
                <span className="text-xs px-2 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300">
                  {mod.loaders.join(', ')}
                </span>
              )}
              <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">{mod.file.name}</p>
            </div>
            <div className="flex gap-2 mt-2">
              <button
                type="button"
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                onClick={(event) => {
                  event.stopPropagation()
                  onOpenExternalLink(
                    `https://modrinth.com/mod/${modNameToSlug(mod.name)}`,
                    `${mod.name} on Modrinth`,
                  )
                }}
              >
                Modrinth
              </button>
              <button
                type="button"
                className="text-xs text-orange-600 dark:text-orange-400 hover:underline"
                onClick={(event) => {
                  event.stopPropagation()
                  onOpenExternalLink(
                    `https://www.curseforge.com/minecraft/mc-mods/${modNameToSlug(mod.name)}`,
                    `${mod.name} on CurseForge`,
                  )
                }}
              >
                CurseForge
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant={(mod.enabled ?? true) ? "primary" : "secondary"}
              size="sm"
              onClick={() => onModToggle?.(mod)}
            >
              {(mod.enabled ?? true) ? (t('modpacks.resourcepack_enable') || "Enabled") : (t('modpacks.resourcepack_disable') || "Disabled")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
              onClick={() => onRemoveMod(mod)}
            >
              ✕
            </Button>
          </div>
        </div>
      </div>

      {/* Dependencies Section */}
      {isExpanded && mod.deps && mod.deps.length > 0 && (
        <div className="border-t border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-900/20 p-3 pl-10 text-sm">
          <p className="font-medium text-xs text-zinc-500 uppercase tracking-wider mb-2">
            {t('modpacks.deps_title') || 'Dependencies'}
          </p>
          <div className="space-y-1">
            {mod.deps.map((dep, idx) => {
              const status = getDependencyStatus(dep.id, dep.versionRange);
              const isMissing = status === 'missing' && dep.kind === 'depends';
              const isIncompatible = status === 'incompatible';

              return (
                <div key={`${dep.id}-${idx}`} className="flex items-center gap-2 text-xs">
                  <span className={cn(
                    "w-1.5 h-1.5 rounded-full shrink-0",
                    isMissing ? "bg-red-500" : isIncompatible ? "bg-yellow-500" : "bg-green-500"
                  )} />
                  <span className={cn(
                    "font-mono",
                    isMissing ? "text-red-600 dark:text-red-400 font-medium" : isIncompatible ? "text-yellow-600 dark:text-yellow-400 font-medium" : "text-zinc-700 dark:text-zinc-300"
                  )}>
                    {dep.id}
                  </span>
                  {dep.versionRange && (
                    <span className={cn("text-zinc-500", isIncompatible && "text-yellow-600 dark:text-yellow-500")}>({String(dep.versionRange)})</span>
                  )}
                  <span className={cn(
                    "px-1.5 py-0.5 rounded text-[10px] uppercase",
                    dep.kind === 'depends'
                      ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                      : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                  )}>
                    {dep.kind}
                  </span>
                  {isMissing && (
                    <span className="text-red-600 dark:text-red-400 font-medium ml-auto">
                      {t('modpacks.dep_missing') || 'Missing'}
                    </span>
                  )}
                  {isIncompatible && (
                    <span className="text-yellow-600 dark:text-yellow-500 font-medium ml-auto">
                      {t('modpacks.dep_incompatible') || 'Incompatible'}
                    </span>
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
