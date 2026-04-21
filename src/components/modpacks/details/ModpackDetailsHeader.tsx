import React from 'react';
import { cn } from '../../../utils/cn';
import { LazyImage } from '../../ui/LazyImage';
import type { ModpackConfig } from '../../../contexts/ModpackContext';
import type { ModpackMetadata } from '@shared/types/modpack';
import {
  buildModpackRuntimeSummary,
  getModpackRuntimeLoaderLabel,
} from '../../../features/modpacks/hooks/useModpackRuntimeSummary';

export type ModpackDetailsTab = 'info' | 'mods' | 'resourcepacks' | 'shaders' | 'worlds' | 'screenshots' | 'settings';

export interface ModpackDetailsHeaderProps {
  modpackName: string;
  metadata: ModpackMetadata | null;
  effectiveConfig: ModpackConfig | null;
  activeTab: ModpackDetailsTab;
  onTabChange: (tab: ModpackDetailsTab) => void;
  t: (key: string) => string;
  getAccentStyles: (type: 'bg' | 'text' | 'border' | 'ring' | 'hover' | 'accent' | 'title' | 'soft-bg' | 'soft-border') => {
    className?: string;
    style?: React.CSSProperties;
  };
  getAccentHex: () => string;
}

const DETAIL_TABS: ReadonlyArray<{
  id: ModpackDetailsTab;
  labelKey: string;
  fallback: string;
}> = [
  { id: 'info', labelKey: 'modpacks.tab_info', fallback: 'Информация' },
  { id: 'mods', labelKey: 'modpacks.tab_mods', fallback: 'Моды' },
  { id: 'resourcepacks', labelKey: 'modpacks.tab_resourcepacks', fallback: 'Ресурспаки' },
  { id: 'shaders', labelKey: 'modpacks.tab_shaders', fallback: 'Шейдеры' },
  { id: 'worlds', labelKey: 'modpacks.tab_worlds', fallback: 'Миры' },
  { id: 'screenshots', labelKey: 'modpacks.tab_screenshots', fallback: 'Скриншоты' },
  { id: 'settings', labelKey: 'modpacks.tab_settings', fallback: 'Настройки' },
];

export const ModpackDetailsHeader: React.FC<ModpackDetailsHeaderProps> = ({
  modpackName,
  metadata,
  effectiveConfig,
  activeTab,
  onTabChange,
  t,
  getAccentStyles,
  getAccentHex,
}) => {
  const runtimeSummary = buildModpackRuntimeSummary({
    config: effectiveConfig,
    metadata,
  });
  const effectiveLoader = runtimeSummary.modLoader;
  const loaderLabel = getModpackRuntimeLoaderLabel(runtimeSummary, t);
  const metadataEntries = [
    metadata?.version
      ? {
          label: t('modpacks.version'),
          value: metadata.version,
        }
      : null,
    runtimeSummary.minecraftVersion
      ? {
          label: t('modpacks.minecraft_version'),
          value: runtimeSummary.minecraftVersion,
        }
      : null,
    effectiveLoader
      ? {
          label: t('modpacks.loader'),
          value: loaderLabel,
        }
      : null,
    metadata?.author
      ? {
          label: t('modpacks.author'),
          value: metadata.author,
        }
      : null,
  ].filter((entry): entry is { label: string; value: string } => Boolean(entry));
  const activeTabBackground = getAccentStyles('soft-bg');
  const activeTabBorder = getAccentStyles('soft-border');
  const activeTabText = getAccentStyles('title');
  const tabRefs = React.useRef<Record<ModpackDetailsTab, HTMLButtonElement | null>>({
    info: null,
    mods: null,
    resourcepacks: null,
    shaders: null,
    worlds: null,
    screenshots: null,
    settings: null,
  });
  const pendingFocusTabRef = React.useRef<ModpackDetailsTab | null>(null);
  const detailTabs = DETAIL_TABS.filter((tab) => {
    if (tab.id !== 'mods') return true;
    return !!effectiveLoader?.type && effectiveLoader.type !== 'vanilla';
  });

  React.useEffect(() => {
    if (pendingFocusTabRef.current !== activeTab) {
      return;
    }

    tabRefs.current[activeTab]?.focus();
    pendingFocusTabRef.current = null;
  }, [activeTab]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, currentTab: ModpackDetailsTab) => {
    const currentIndex = detailTabs.findIndex((tab) => tab.id === currentTab);
    if (currentIndex === -1) {
      return;
    }

    let nextTabId: ModpackDetailsTab | null = null;

    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        nextTabId = detailTabs[(currentIndex + 1) % detailTabs.length].id;
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        nextTabId = detailTabs[(currentIndex - 1 + detailTabs.length) % detailTabs.length].id;
        break;
      case 'Home':
        nextTabId = detailTabs[0].id;
        break;
      case 'End':
        nextTabId = detailTabs[detailTabs.length - 1].id;
        break;
      default:
        break;
    }

    if (!nextTabId) {
      return;
    }

    event.preventDefault();
    pendingFocusTabRef.current = nextTabId;
    onTabChange(nextTabId);
  };

  return (
    <div className="min-w-0 space-y-3">
      <div className="flex flex-col gap-4 md:flex-row md:items-start">
        <LazyImage
          src={metadata?.iconUrl}
          alt={modpackName}
          fallbackKind={!metadata?.source || metadata.source === 'local' ? 'app-icon' : 'content-artwork'}
          className="h-14 w-14 self-start rounded-2xl border border-border/70 object-cover sm:h-16 sm:w-16"
        />
        <div className="min-w-0 flex-1 space-y-3">
          <div className="space-y-1.5">
            <div className="kicker-label">{t('modpacks.details_title') || 'Modpack details'}</div>
            <h3 className="text-xl font-bold leading-tight text-foreground sm:text-2xl">{modpackName}</h3>
          </div>
          {metadataEntries.length > 0 && (
            <div className="flex flex-wrap gap-1.5" data-testid="modpack-details-metadata">
              {metadataEntries.map((entry) => (
                <div key={entry.label} className="surface-inline min-w-0 rounded-full px-3 py-2">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">{entry.label}</span>
                  <span className="ml-2 break-words text-sm font-medium leading-5 text-foreground">{entry.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div
        className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4"
        role="tablist"
        aria-label={t('modpacks.details_title') || 'Modpack details'}
        aria-orientation="horizontal"
        data-testid="modpack-details-tablist"
      >
        {detailTabs.map((tab) => {
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              ref={(node) => {
                tabRefs.current[tab.id] = node;
              }}
              type="button"
              onClick={() => onTabChange(tab.id)}
              onKeyDown={(event) => handleKeyDown(event, tab.id)}
              role="tab"
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              data-state={isActive ? 'active' : 'inactive'}
              className={cn(
                'w-full rounded-xl border px-3 py-2.5 text-left text-sm font-medium leading-5 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--accent-main))] focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                isActive
                  ? cn(
                      'text-foreground shadow-sm',
                      activeTabBackground.className,
                      activeTabBorder.className,
                      activeTabText.className,
                    )
                  : 'border-border/60 bg-background/68 text-secondary hover:border-[rgb(var(--accent-main)/0.18)] hover:bg-card/78 hover:text-foreground',
              )}
              style={isActive ? {
                ...activeTabBackground.style,
                ...activeTabBorder.style,
                ...activeTabText.style,
                boxShadow: `0 0 0 1px ${getAccentHex()}20`,
              } : undefined}
            >
              {t(tab.labelKey) || tab.fallback}
            </button>
          );
        })}
      </div>
    </div>
  );
};
