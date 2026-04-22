import React, { useEffect, useRef } from 'react';
import { cn } from '../../utils/cn';
import type { AccentStyleType } from '../../contexts/settings/types';
import {
  getSettingsPanelId,
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
      className="settings-segmented-row settings-tab-row grid-cols-2 md:grid-cols-3 xl:grid-cols-6"
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
            tabIndex={isActive ? 0 : -1}
            data-state={isActive ? 'active' : 'inactive'}
            className={cn(
              'settings-segmented-option settings-tab-option w-full text-center',
              isActive ? 'bg-card/92' : 'bg-transparent'
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
                'text-sm font-semibold leading-5 normal-case tracking-normal',
                isActive ? activeLabel?.className ?? 'text-foreground' : 'text-foreground'
              )}
              style={isActive ? activeLabel?.style : undefined}
            >
              {tab.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
