import React from 'react';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
import { LoadingSpinner } from '../../ui/LoadingSpinner';
import { Select } from '../../ui/Select';
import { cn } from '../../../utils/cn';
import { modNameToSlug } from '../../../utils/modSlug';

export interface ModpackModEntry {
  id: string;
  name: string;
  version: string;
  loaders: string[];
  file: { path: string; name: string; size: number; mtimeMs: number };
  enabled?: boolean;
}

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
  t,
  getAccentStyles,
}) => {
  const filteredMods = mods.filter((mod) => {
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

  return (
    <div className="space-y-4">
      {loadingMods ? (
        <div className="flex flex-col items-center justify-center py-8 gap-3">
          <LoadingSpinner size="md" />
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{t('modpacks.loading')}</p>
        </div>
      ) : mods.length === 0 ? (
        <div className="text-center py-8 space-y-4">
          <p className="text-zinc-500 dark:text-zinc-400">{t('modpacks.no_mods') || 'Нет модов'}</p>
          <Button variant="primary" size="md" onClick={onAddMod} style={getAccentStyles('bg').style}>
            {t('modpacks.add') || 'Добавить'}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-3">
            <div className="flex flex-wrap items-stretch gap-2">
              <div className="flex-1 min-w-[140px] flex">
                <Input
                  placeholder={t('modpacks.search_mods') || 'Search mods...'}
                  value={modSearchQuery}
                  onChange={(e) => onModSearchQueryChange(e.target.value)}
                  className="w-full"
                />
              </div>
              <div className="w-[7.5rem] shrink-0 flex">
                <Select
                  value={modFilterStatus}
                  onChange={(e) => onModFilterStatusChange(e.target.value as 'all' | 'enabled' | 'disabled')}
                  className="w-[7.5rem]"
                >
                  <option value="all">{t('modpacks.filter_all') || 'All'}</option>
                  <option value="enabled">{t('modpacks.filter_enabled') || 'Enabled'}</option>
                  <option value="disabled">{t('modpacks.filter_disabled') || 'Disabled'}</option>
                </Select>
              </div>
              <Button
                variant="primary"
                size="md"
                className="shrink-0 whitespace-nowrap self-stretch min-h-[2.75rem]"
                onClick={onAddMod}
                style={getAccentStyles('bg').style}
              >
                {t('modpacks.add') || 'Добавить'}
              </Button>
            </div>
            <div className="text-sm text-zinc-600 dark:text-zinc-400">
              {t('modpacks.mods_stats') || 'Total'}: {mods.length} / {t('modpacks.enabled') || 'Enabled'}:{' '}
              {mods.filter((m) => m.enabled).length}
            </div>
          </div>
          <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar">
            {filteredMods.map((mod) => (
              <div
                key={mod.id}
                className={cn(
                  'p-3 rounded-lg border transition-all',
                  mod.enabled
                    ? 'bg-zinc-50 dark:bg-zinc-900/40 border-zinc-200 dark:border-zinc-700'
                    : 'bg-zinc-100/50 dark:bg-zinc-800/40 border-zinc-300 dark:border-zinc-600 opacity-60'
                )}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={mod.enabled ?? true}
                    onChange={() => onModToggle?.(mod)}
                    className="mt-1 w-4 h-4 rounded border-zinc-300 dark:border-zinc-600 text-zinc-600 dark:text-zinc-400 focus:ring-2 focus:ring-zinc-500 dark:focus:ring-zinc-400"
                  />
                  <div className="flex-1 min-w-0">
                    <h5
                      className={cn(
                        'font-medium truncate',
                        mod.enabled ? 'text-zinc-900 dark:text-white' : 'text-zinc-500 dark:text-zinc-400'
                      )}
                    >
                      {mod.name}
                    </h5>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">
                        {t('modpacks.version')}: {mod.version}
                      </span>
                      {mod.loaders.length > 0 && (
                        <span className="text-xs px-2 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300">
                          {mod.loaders.join(', ')}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 truncate">{mod.file.name}</p>
                    <div className="flex gap-2 mt-2">
                      <a
                        href={`https://modrinth.com/mod/${modNameToSlug(mod.name)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Modrinth
                      </a>
                      <a
                        href={`https://www.curseforge.com/minecraft/mc-mods/${modNameToSlug(mod.name)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-orange-600 dark:text-orange-400 hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        CurseForge
                      </a>
                    </div>
                  </div>
                  <Button variant="danger" size="sm" onClick={() => onRemoveMod(mod)}>
                    {t('modpacks.remove') || 'Удалить'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
