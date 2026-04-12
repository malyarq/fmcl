export type SettingsTabId = 'appearance' | 'downloads' | 'launcher' | 'storage' | 'accounts' | 'statistics';

export type SettingsTabConfig = {
  id: SettingsTabId;
  labelKey: string;
};

export const SETTINGS_TABS: SettingsTabConfig[] = [
  { id: 'appearance', labelKey: 'settings.tab_appearance' },
  { id: 'downloads', labelKey: 'settings.tab_downloads' },
  { id: 'launcher', labelKey: 'settings.tab_launcher' },
  { id: 'storage', labelKey: 'settings.tab_storage' },
  { id: 'accounts', labelKey: 'settings.tab_accounts' },
  { id: 'statistics', labelKey: 'settings.tab_statistics' },
];

export function getSettingsTabId(tabId: SettingsTabId): string {
  return `settings-tab-${tabId}`;
}

export function getSettingsPanelId(tabId: SettingsTabId): string {
  return `settings-panel-${tabId}`;
}
