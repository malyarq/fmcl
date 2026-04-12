import React, { useEffect, useRef } from 'react';
import { cn } from '../../utils/cn';
import {
  getSettingsPanelId,
  getSettingsTabId,
  SETTINGS_TABS,
  type SettingsTabId,
} from './settingsTabs';

export function SettingsTabsHeader(props: {
  activeTab: SettingsTabId;
  onTabChange: (tab: SettingsTabId) => void;
  t: (key: string) => string;
  getAccentStyles: (type: 'border') => { className?: string; style?: React.CSSProperties };
}) {
  const { activeTab, onTabChange, t, getAccentStyles } = props;
  const tabRefs = useRef<Record<SettingsTabId, HTMLButtonElement | null>>({
    appearance: null,
    downloads: null,
    launcher: null,
    storage: null,
    accounts: null,
    statistics: null,
  });
  const pendingFocusTabRef = useRef<SettingsTabId | null>(null);

  useEffect(() => {
    if (pendingFocusTabRef.current !== activeTab) {
      return;
    }

    tabRefs.current[activeTab]?.focus();
    pendingFocusTabRef.current = null;
  }, [activeTab]);

  const tabs = SETTINGS_TABS.map((tab) => ({
    ...tab,
    label: t(tab.labelKey),
  }));

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, currentTab: SettingsTabId) => {
    const currentIndex = SETTINGS_TABS.findIndex((tab) => tab.id === currentTab);
    if (currentIndex === -1) {
      return;
    }

    let nextTabId: SettingsTabId | null = null;

    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        nextTabId = SETTINGS_TABS[(currentIndex + 1) % SETTINGS_TABS.length].id;
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        nextTabId = SETTINGS_TABS[(currentIndex - 1 + SETTINGS_TABS.length) % SETTINGS_TABS.length].id;
        break;
      case 'Home':
        nextTabId = SETTINGS_TABS[0].id;
        break;
      case 'End':
        nextTabId = SETTINGS_TABS[SETTINGS_TABS.length - 1].id;
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
    <div
      className="flex gap-2 border-b border-zinc-200 dark:border-zinc-700 -mx-6 px-6"
      role="tablist"
      aria-label={t('settings.title')}
      aria-orientation="horizontal"
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const accentBorderStyle = isActive ? getAccentStyles('border').style : undefined;
        return (
          <button
            key={tab.id}
            ref={(node) => {
              tabRefs.current[tab.id] = node;
            }}
            onClick={() => onTabChange(tab.id)}
            onKeyDown={(event) => handleKeyDown(event, tab.id)}
            id={getSettingsTabId(tab.id)}
            role="tab"
            aria-selected={isActive}
            aria-controls={getSettingsPanelId(tab.id)}
            tabIndex={isActive ? 0 : -1}
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
