export type SettingsTabId = 'appearance' | 'downloads' | 'launcher' | 'storage' | 'accounts' | 'statistics';

export type SettingsTabConfig = {
  id: SettingsTabId;
  labelKey: string;
  descriptionKey: string;
  panelHintKey: string;
};

export const SETTINGS_TABS: SettingsTabConfig[] = [
  {
    id: 'appearance',
    labelKey: 'settings.tab_appearance',
    descriptionKey: 'settings.theme_presets_desc',
    panelHintKey: 'settings.doneHint',
  },
  {
    id: 'downloads',
    labelKey: 'settings.tab_downloads',
    descriptionKey: 'settings.downloadsHint',
    panelHintKey: 'settings.downloadsHint',
  },
  {
    id: 'launcher',
    labelKey: 'settings.tab_launcher',
    descriptionKey: 'settings.launcherHint',
    panelHintKey: 'settings.launcherHint',
  },
  {
    id: 'storage',
    labelKey: 'settings.tab_storage',
    descriptionKey: 'settings.storage.description',
    panelHintKey: 'settings.storage.description',
  },
  {
    id: 'accounts',
    labelKey: 'settings.tab_accounts',
    descriptionKey: 'accounts.description',
    panelHintKey: 'accounts.description',
  },
  {
    id: 'statistics',
    labelKey: 'settings.tab_statistics',
    descriptionKey: 'stats.description',
    panelHintKey: 'stats.description',
  },
];

export function getSettingsTabId(tabId: SettingsTabId): string {
  return `settings-tab-${tabId}`;
}

export function getSettingsTabLabelId(tabId: SettingsTabId): string {
  return `${getSettingsTabId(tabId)}-label`;
}

export function getSettingsTabDescriptionId(tabId: SettingsTabId): string {
  return `${getSettingsTabId(tabId)}-description`;
}

export function getSettingsPanelId(tabId: SettingsTabId): string {
  return `settings-panel-${tabId}`;
}

export function getSettingsTabConfig(tabId: SettingsTabId): SettingsTabConfig {
  return SETTINGS_TABS.find((tab) => tab.id === tabId) ?? SETTINGS_TABS[0];
}
