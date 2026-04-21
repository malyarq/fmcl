import React, { useEffect, useRef } from 'react';
import { cn } from '../../utils/cn';
import type { AccentStyleType } from '../../contexts/settings/types';
import {
  getSettingsPanelId,
  getSettingsTabDescriptionId,
  getSettingsTabId,
  getSettingsTabLabelId,
  getTranslatedSettingsTabs,
  SETTINGS_TABS,
  type SettingsTabId,
} from './settingsTabs';

export function SettingsTabsHeader(props: {
  activeTab: SettingsTabId;
  onTabChange: (tab: SettingsTabId) => void;
  t: (key: string) => string;
  getAccentStyles: (type: AccentStyleType) => { className?: string; style?: React.CSSProperties };
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

  const tabs = getTranslatedSettingsTabs(t);

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
        const activeBackground = isActive ? getAccentStyles('soft-bg') : undefined;
        const activeBorder = isActive ? getAccentStyles('soft-border') : undefined;
        const activeLabel = isActive ? getAccentStyles('title') : undefined;
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
            data-state={isActive ? 'active' : 'inactive'}
            className={cn(
              'flex min-h-[4.5rem] flex-col items-start rounded-xl border px-3.5 py-3 text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--accent-main))] focus-visible:ring-offset-2 focus-visible:ring-offset-background',
              isActive
                ? 'border-border bg-card/92 text-foreground shadow-[0_10px_24px_rgba(0,0,0,0.12)]'
                : 'border-border/60 bg-background/72 text-secondary hover:border-[rgb(var(--accent-main)/0.18)] hover:bg-card/82 hover:text-foreground'
            )}
            style={
              isActive
                ? {
                    ...activeBackground?.style,
                    ...activeBorder?.style,
                  }
                : undefined
            }
          >
            <span
              id={tabLabelId}
              className={cn(
                'text-sm font-semibold leading-5',
                isActive ? activeLabel?.className ?? 'text-foreground' : 'text-foreground'
              )}
              style={isActive ? activeLabel?.style : undefined}
            >
              {tab.label}
            </span>
            <span
              id={tabDescriptionId}
              className={cn(
                'mt-1 text-[11px] leading-4.5',
                isActive ? 'text-foreground/78' : 'text-secondary'
              )}
            >
              {tab.description}
            </span>
          </button>
        );
      })}
    </div>
  );
}
