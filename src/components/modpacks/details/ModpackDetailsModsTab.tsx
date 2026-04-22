import React from 'react';
import { ExternalLink, Filter, PackagePlus, RefreshCw, Trash2 } from 'lucide-react';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
import { LoadingSpinner } from '../../ui/LoadingSpinner';
import { Select } from '../../ui/Select';
import { cn } from '../../../utils/cn';
import { modNameToSlug } from '../../../utils/modSlug';
import type { ModEntry } from '@shared/types/mods';
import type { ModLoaderType as RuntimeModLoaderType } from '@shared/types/modpack';
import {
  describeVersionRequirement,
  isVersionCompatible,
  type VersionRequirementDescriptor,
} from '../../../utils/versionCheck';
import { externalLinksIPC } from '../../../services/ipc/externalLinksIPC';

export type ModpackModEntry = ModEntry;
type TranslateFn = (key: string, params?: Record<string, string | number>) => string;

export interface ModpackRuntimeDependencyContext {
  minecraft?: string;
  modLoader?: {
    type: RuntimeModLoaderType;
    version?: string;
  };
}

type DependencyStatus = 'missing' | 'incompatible' | 'installed' | 'provided' | 'unverified';
type DependencySource = 'runtime' | 'mod' | 'none';

interface DependencyResolution {
  status: DependencyStatus;
  source: DependencySource;
  providedVersion?: string;
}

const LOADER_RUNTIME_IDS: Record<Exclude<RuntimeModLoaderType, 'vanilla'>, string[]> = {
  fabric: ['fabric', 'fabricloader'],
  quilt: ['quilt', 'quilt-loader', 'quilt_loader'],
  forge: ['forge'],
  neoforge: ['neoforge'],
};

function normalizeDependencyId(id: string): string {
  return id.trim().toLowerCase();
}

function resolveRuntimeDependency(
  depId: string,
  runtimeContext?: ModpackRuntimeDependencyContext,
): { matched: boolean; version?: string } {
  if (!runtimeContext) {
    return { matched: false };
  }

  const normalizedDepId = normalizeDependencyId(depId);
  if (normalizedDepId === 'minecraft') {
    return {
      matched: Boolean(runtimeContext.minecraft),
      version: runtimeContext.minecraft,
    };
  }

  const loaderType = runtimeContext.modLoader?.type;
  if (!loaderType || loaderType === 'vanilla') {
    return { matched: false };
  }

  if (!LOADER_RUNTIME_IDS[loaderType].includes(normalizedDepId)) {
    return { matched: false };
  }

  return {
    matched: true,
    version: runtimeContext.modLoader?.version,
  };
}

function formatVersionRequirement(descriptor: VersionRequirementDescriptor, t: TranslateFn): string | null {
  switch (descriptor.kind) {
    case 'any':
      return null;
    case 'exact':
      return t('modpacks.dep_version_exact', { version: descriptor.version });
    case 'minimum':
      return t(
        descriptor.inclusive ? 'modpacks.dep_version_minimum' : 'modpacks.dep_version_above',
        { version: descriptor.version },
      );
    case 'maximum':
      return t(
        descriptor.inclusive ? 'modpacks.dep_version_maximum' : 'modpacks.dep_version_below',
        { version: descriptor.version },
      );
    case 'between':
      return t(
        descriptor.minInclusive && descriptor.maxInclusive
          ? 'modpacks.dep_version_between'
          : 'modpacks.dep_version_between_strict',
        { min: descriptor.min, max: descriptor.max },
      );
    case 'oneOf': {
      const parts = descriptor.items
        .map((item) => formatVersionRequirement(item, t))
        .filter((item): item is string => Boolean(item));
      if (parts.length === 0) {
        return null;
      }
      return parts.join(` ${t('modpacks.dep_version_or')} `);
    }
    case 'raw':
      return descriptor.value;
    default:
      return null;
  }
}

export interface ModpackDetailsModsTabProps {
  mods: ModpackModEntry[];
  loadingMods: boolean;
  initialExpandedModId?: string;
  modSearchQuery: string;
  onModSearchQueryChange: (value: string) => void;
  modFilterStatus: 'all' | 'enabled' | 'disabled';
  onModFilterStatusChange: (value: 'all' | 'enabled' | 'disabled') => void;
  onAddMod: () => void;
  onRemoveMod: (mod: ModpackModEntry) => Promise<void>;
  onModToggle?: (mod: ModpackModEntry) => void;
  onRefresh?: () => void;
  runtimeContext?: ModpackRuntimeDependencyContext;
  t: TranslateFn;
  getAccentStyles: (type: 'bg' | 'text' | 'border' | 'ring' | 'hover' | 'accent' | 'title' | 'soft-bg' | 'soft-border') => {
    className?: string;
    style?: React.CSSProperties;
  };
}

export const ModpackDetailsModsTab: React.FC<ModpackDetailsModsTabProps> = ({
  mods,
  loadingMods,
  initialExpandedModId,
  modSearchQuery,
  onModSearchQueryChange,
  modFilterStatus,
  onModFilterStatusChange,
  onAddMod,
  onRemoveMod,
  onModToggle,
  onRefresh,
  runtimeContext,
  t,
}) => {
  const [expandedModId, setExpandedModId] = React.useState<string | null>(initialExpandedModId ?? null);

  const toggleExpand = React.useCallback((modId: string) => {
    setExpandedModId((prev) => (prev === modId ? null : modId));
  }, []);

  const resolveDependency = React.useCallback(
    (depId: string, versionRange?: string | string[]) => {
      const runtimeMatch = resolveRuntimeDependency(depId, runtimeContext);
      if (runtimeMatch.matched) {
        if (versionRange && !runtimeMatch.version) {
          return {
            status: 'unverified',
            source: 'runtime',
          } satisfies DependencyResolution;
        }

        const compatible = !versionRange || isVersionCompatible(runtimeMatch.version ?? '', versionRange);
        return {
          status: compatible ? 'provided' : 'incompatible',
          source: 'runtime',
          providedVersion: runtimeMatch.version,
        } satisfies DependencyResolution;
      }

      const installed = mods.find(
        (mod) => mod.enabled !== false && normalizeDependencyId(mod.id) === normalizeDependencyId(depId),
      );
      if (!installed) {
        return {
          status: 'missing',
          source: 'none',
        } satisfies DependencyResolution;
      }

      if (!isVersionCompatible(installed.version, versionRange)) {
        return {
          status: 'incompatible',
          source: 'mod',
          providedVersion: installed.version,
        } satisfies DependencyResolution;
      }

      return {
        status: 'installed',
        source: 'mod',
        providedVersion: installed.version,
      } satisfies DependencyResolution;
    },
    [mods, runtimeContext],
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
  const renderModItem = (mod: ModpackModEntry) => (
    <ModItem
      key={mod.id}
      mod={mod}
      isExpanded={expandedModId === mod.id}
      toggleExpand={toggleExpand}
      onModToggle={onModToggle}
      onRemoveMod={onRemoveMod}
      onOpenExternalLink={handleOpenExternalLink}
      resolveDependency={resolveDependency}
      t={t}
    />
  );

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

        <div
          className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_repeat(2,minmax(0,9rem))]"
          data-testid="mods-summary"
        >
          <div className="surface-inline flex items-start gap-3 p-3 text-sm text-secondary">
            <Filter className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>{t('modpacks.mods_manage_hint')}</span>
          </div>
          <div className="surface-inline rounded-2xl px-3 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">{t('modpacks.enabled')}</p>
            <p className="mt-2 text-base font-semibold text-foreground">{enabledCount}</p>
          </div>
          <div className="surface-inline rounded-2xl px-3 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">{t('modpacks.installed')}</p>
            <p className="mt-2 text-base font-semibold text-foreground">{mods.length}</p>
          </div>
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
        <div className="space-y-2">
          {filteredMods.map(renderModItem)}
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
  resolveDependency: (id: string, range?: string | string[]) => DependencyResolution;
  t: TranslateFn;
}>(({ mod, isExpanded, toggleExpand, onModToggle, onRemoveMod, onOpenExternalLink, resolveDependency, t }) => {
  const dependencyTone = mod.deps.reduce<'neutral' | 'warning' | 'error'>((tone, dep) => {
    const resolution = resolveDependency(dep.id, dep.versionRange);
    if (dep.kind !== 'depends') {
      return tone;
    }

    if (resolution.status === 'missing' || resolution.status === 'incompatible') {
      return 'error';
    }

    if (resolution.status === 'unverified' && tone !== 'error') {
      return 'warning';
    }

    return tone;
  }, 'neutral');

  return (
    <div
      className={cn(
        'mb-2 rounded-2xl border p-4 shadow-[0_12px_32px_rgba(0,0,0,0.12)] transition-colors',
        mod.enabled
          ? 'border-border/70 bg-card/86'
          : 'border-border/55 bg-background/78 text-secondary',
      )}
      data-state={mod.enabled ? 'active' : 'inactive'}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <button
          type="button"
          className="min-w-0 flex-1 rounded-2xl text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--accent-main))] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          onClick={() => toggleExpand(mod.id)}
          aria-expanded={isExpanded}
        >
          <div className="flex flex-wrap items-center gap-2">
            <h5 className="break-words text-base font-semibold leading-5 text-foreground">{mod.name}</h5>
            <span className="rounded-full border border-border/70 bg-background/70 px-2 py-0.5 text-xs font-medium text-secondary">
              {t('modpacks.version')}: {mod.version}
            </span>
            {mod.deps.length > 0 && (
              <span
                data-tone={dependencyTone}
                className={cn(
                  'rounded-full border px-2 py-0.5 text-xs font-medium',
                  dependencyTone === 'error'
                    ? 'border-red-500/30 bg-red-500/10 text-red-400'
                    : dependencyTone === 'warning'
                      ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                    : 'border-border/70 bg-background/70 text-secondary',
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

          <p className="mt-2 break-words text-sm text-secondary">{mod.file.name}</p>
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
              const resolution = resolveDependency(dep.id, dep.versionRange);
              const requirementText = formatVersionRequirement(describeVersionRequirement(dep.versionRange), t);
              const isMissing = resolution.status === 'missing' && dep.kind === 'depends';
              const isIncompatible = resolution.status === 'incompatible';
              const isUnverified = resolution.status === 'unverified';
              const isRuntimeProvided = resolution.status === 'provided';
              const statusText = isMissing
                ? t('modpacks.dep_missing')
                : isUnverified
                  ? t('modpacks.dep_runtime_unverified')
                : isIncompatible && resolution.source === 'runtime'
                  ? t('modpacks.dep_runtime_incompatible')
                  : isIncompatible
                    ? t('modpacks.dep_incompatible')
                    : isRuntimeProvided
                      ? t('modpacks.dep_provided_runtime')
                      : null;

              return (
                <div key={`${dep.id}-${index}`} className="surface-inline flex flex-wrap items-center gap-2 p-3 text-xs">
                  <span
                    className={cn(
                      'h-2 w-2 rounded-full',
                      isMissing ? 'bg-red-500' : isIncompatible || isUnverified ? 'bg-yellow-500' : 'bg-emerald-500',
                    )}
                  />
                  <span className="font-mono text-foreground">{dep.id}</span>
                  {requirementText && <span className="text-secondary">({requirementText})</span>}
                  {resolution.source === 'runtime' && resolution.providedVersion && (
                    <span className="text-secondary">{t('modpacks.dep_runtime_version', { version: resolution.providedVersion })}</span>
                  )}
                  <span className="rounded-full border border-border/70 bg-background/70 px-2 py-0.5 text-[10px] uppercase text-secondary">
                    {dep.kind}
                  </span>
                  {statusText && (
                    <span
                      className={cn(
                        'ml-auto font-medium',
                        isMissing ? 'text-red-400' : isIncompatible || isUnverified ? 'text-yellow-400' : 'text-emerald-400',
                      )}
                    >
                      {statusText}
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
