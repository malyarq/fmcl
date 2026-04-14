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

      <div className="mb-4 flex gap-2 overflow-x-auto border-b border-border/70 scrollbar-hide" role="tablist" aria-label={t('modpacks.details_title') || 'Modpack details'}>
        {(['info', 'mods', 'resourcepacks', 'shaders', 'worlds', 'screenshots', 'settings'] as const)
          .filter((tab) => {
            if (tab !== 'mods') return true;
            const loaderType = effectiveConfig?.runtime?.modLoader?.type ?? metadata?.modLoader?.type;
            return !!loaderType && loaderType !== 'vanilla';
          })
          .map((tab) => (
            <button
              key={tab}
              onClick={() => onTabChange(tab)}
              role="tab"
              aria-selected={activeTab === tab}
              className={cn(
                'px-4 py-2 text-sm font-medium transition-colors border-b-2 whitespace-nowrap',
                activeTab === tab
                  ? cn('border-opacity-100', getAccentStyles('border').className)
                  : 'border-transparent text-secondary hover:text-foreground'
              )}
              style={activeTab === tab ? { borderColor: getAccentHex() } : undefined}
            >
              {tab === 'info' ? (t('modpacks.tab_info') || 'Информация') :
                tab === 'mods' ? (t('modpacks.tab_mods') || 'Моды') :
                  tab === 'resourcepacks' ? (t('modpacks.tab_resourcepacks') || 'Ресурспаки') :
                    tab === 'shaders' ? (t('modpacks.tab_shaders') || 'Шейдеры') :
                      tab === 'worlds' ? (t('modpacks.tab_worlds') || 'Миры') :
                        tab === 'screenshots' ? (t('modpacks.tab_screenshots') || 'Скриншоты') :
                          (t('modpacks.tab_settings') || 'Настройки')}
            </button>
          ))}
      </div>
    </div>
  );
};
