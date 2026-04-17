import React from 'react';
import { cn } from '../../../utils/cn';
import { LazyImage } from '../../ui/LazyImage';
import type { ModpackConfig } from '../../../contexts/ModpackContext';
import type { ModpackMetadata } from '@shared/types/modpack';

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
  const effectiveLoader = effectiveConfig?.runtime?.modLoader ?? metadata?.modLoader;
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
    <div className="flex-shrink-0 px-6 pt-6 pb-0">
      <div className="surface-card mb-6 flex items-start gap-4 p-5">
        {metadata?.iconUrl && (
          <LazyImage
            src={metadata.iconUrl}
            alt={modpackName}
            className="h-20 w-20 rounded-2xl border border-border/70 object-cover"
            fallback="/icon.png"
          />
        )}
        <div className="flex-1 min-w-0">
          <h3 className="mb-2 text-xl font-bold text-foreground">{modpackName}</h3>
          {metadata && (
            <div className="space-y-1 text-sm">
              {metadata.version && (
                <p className="text-secondary">
                  {t('modpacks.version')}: {metadata.version}
                </p>
              )}
              {(effectiveConfig || metadata.minecraftVersion) && (
                <p className="text-secondary">
                  {t('modpacks.minecraft_version')}:{' '}
                  {effectiveConfig?.runtime.minecraft ?? metadata.minecraftVersion}
                </p>
              )}
              {effectiveLoader && (
                <p className="text-secondary">
                  {t('modpacks.loader')}:{' '}
                  {effectiveLoader.type}
                  {effectiveLoader.version ? ` ${effectiveLoader.version}` : ''}
                </p>
              )}
              {metadata.author && (
                <p className="text-secondary">
                  {t('modpacks.author')}: {metadata.author}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <div
        className="surface-inline mb-4 flex flex-wrap gap-2 p-2"
        role="tablist"
        aria-label={t('modpacks.details_title') || 'Modpack details'}
        aria-orientation="horizontal"
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
              className={cn(
                'min-w-[9.5rem] flex-1 rounded-xl border px-3 py-2 text-sm font-medium leading-5 transition-colors sm:flex-none',
                isActive
                  ? cn(
                      'text-foreground shadow-sm',
                      activeTabBackground.className,
                      activeTabBorder.className,
                      activeTabText.className
                    )
                  : 'border-border/60 bg-background/68 text-secondary hover:border-border hover:bg-card/72 hover:text-foreground'
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
