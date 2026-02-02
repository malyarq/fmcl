import React from 'react';
import { cn } from '../../../utils/cn';
import type { ModpackConfig } from '../../../contexts/ModpackContext';
import type { ModpackMetadata } from '@shared/types/modpack';

export type ModpackDetailsTab = 'info' | 'mods' | 'settings';

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
}) => (
  <div className="flex-shrink-0 px-6 pt-6 pb-0">
    <div className="flex items-start gap-4 mb-6 pb-4 border-b border-zinc-200 dark:border-zinc-700">
      {metadata?.iconUrl && (
        <img
          src={metadata.iconUrl}
          alt={modpackName}
          className="w-20 h-20 rounded-lg object-cover border border-zinc-200 dark:border-zinc-700"
          onError={(e) => {
            if (e.currentTarget.src !== '/icon.png') {
              e.currentTarget.src = '/icon.png';
            }
          }}
        />
      )}
      <div className="flex-1 min-w-0">
        <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">{modpackName}</h3>
        {metadata && (
          <div className="space-y-1 text-sm">
            {metadata.version && (
              <p className="text-zinc-600 dark:text-zinc-400">
                {t('modpacks.version')}: {metadata.version}
              </p>
            )}
            {(effectiveConfig || metadata.minecraftVersion) && (
              <p className="text-zinc-600 dark:text-zinc-400">
                {t('modpacks.minecraft_version')}:{' '}
                {effectiveConfig?.runtime.minecraft ?? metadata.minecraftVersion}
              </p>
            )}
            {(effectiveConfig?.runtime.modLoader || metadata.modLoader) && (
              <p className="text-zinc-600 dark:text-zinc-400">
                {t('modpacks.loader')}:{' '}
                {(effectiveConfig?.runtime.modLoader?.type ?? metadata.modLoader?.type) || ''}
                {metadata.modLoader?.version && ` ${metadata.modLoader.version}`}
              </p>
            )}
            {metadata.author && (
              <p className="text-zinc-600 dark:text-zinc-400">
                {t('modpacks.author')}: {metadata.author}
              </p>
            )}
          </div>
        )}
      </div>
    </div>

    <div className="flex gap-2 mb-4 border-b border-zinc-200 dark:border-zinc-700">
      {(['info', 'mods', 'settings'] as const)
        .filter((tab) => {
          if (tab !== 'mods') return true;
          const loaderType = effectiveConfig?.runtime?.modLoader?.type ?? metadata?.modLoader?.type;
          return loaderType && loaderType !== 'vanilla';
        })
        .map((tab) => (
        <button
          key={tab}
          onClick={() => onTabChange(tab)}
          className={cn(
            'px-4 py-2 text-sm font-medium transition-colors border-b-2',
            activeTab === tab
              ? cn('border-opacity-100', getAccentStyles('border').className)
              : 'border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300'
          )}
          style={activeTab === tab ? { borderColor: getAccentHex() } : undefined}
        >
          {tab === 'info' ? (t('modpacks.tab_info') || 'Информация') : tab === 'mods' ? (t('modpacks.tab_mods') || 'Моды') : (t('modpacks.tab_settings') || 'Настройки')}
        </button>
      ))}
    </div>
  </div>
);
