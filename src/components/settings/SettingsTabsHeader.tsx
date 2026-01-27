import React from 'react';
import { cn } from '../../utils/cn';

export type SettingsTabId = 'appearance' | 'game' | 'downloads' | 'launcher';

export function SettingsTabsHeader(props: {
  activeTab: SettingsTabId;
  onTabChange: (tab: SettingsTabId) => void;
  t: (key: string) => string;
  getAccentStyles: (type: 'border') => { className?: string; style?: React.CSSProperties };
}) {
  const { activeTab, onTabChange, t, getAccentStyles } = props;

  const tabs: { id: SettingsTabId; label: string }[] = [
    { id: 'appearance', label: t('settings.tab_appearance') },
    { id: 'game', label: t('settings.tab_game') },
    { id: 'downloads', label: t('settings.tab_downloads') },
    { id: 'launcher', label: t('settings.tab_launcher') },
  ];

  return (
    <div className="flex gap-2 border-b border-zinc-200 dark:border-zinc-700 -mx-6 px-6">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const accentBorderStyle = isActive ? getAccentStyles('border').style : undefined;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              'px-4 py-2 text-sm font-medium transition-all border-b-2 -mb-[1px]',
              isActive ? 'text-zinc-900 dark:text-white' : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
            )}
            style={accentBorderStyle}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

