import React, { useEffect, useRef } from 'react';
import { cn } from '../../utils/cn';
import {
  getSettingsPanelId,
  getSettingsTabDescriptionId,
  getSettingsTabId,
  getSettingsTabLabelId,
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
    description: t(tab.descriptionKey),
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
      className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3"
      role="tablist"
      aria-label={t('settings.title')}
      aria-orientation="horizontal"
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const accentBorderStyle = isActive ? getAccentStyles('border').style : undefined;
        const tabLabelId = getSettingsTabLabelId(tab.id);
        const tabDescriptionId = getSettingsTabDescriptionId(tab.id);

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
            aria-labelledby={tabLabelId}
            aria-describedby={tabDescriptionId}
            tabIndex={isActive ? 0 : -1}
            className={cn(
              'flex min-h-[5.75rem] flex-col items-start rounded-2xl border px-4 py-3 text-left transition-all',
              isActive
                ? 'border-border bg-card text-foreground shadow-sm'
                : 'border-border/60 bg-background/68 text-secondary hover:border-border hover:bg-card/72 hover:text-foreground'
            )}
            style={accentBorderStyle}
          >
            <span id={tabLabelId} className="text-sm font-semibold text-foreground">
              {tab.label}
            </span>
            <span id={tabDescriptionId} className="mt-1 text-xs leading-5 text-secondary">
              {tab.description}
            </span>
          </button>
        );
      })}
    </div>
  );
}
