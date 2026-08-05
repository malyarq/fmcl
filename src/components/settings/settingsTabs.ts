export type SettingsTabId = 'appearance' | 'downloads' | 'launcher' | 'storage' | 'accounts' | 'statistics';

export type SettingsTabConfig = {
  id: SettingsTabId;
  labelKey: string;
  labelFallback: string;
};

export type ResolvedSettingsTabConfig = SettingsTabConfig & {
  label: string;
};

type SettingsTranslator = (key: string) => string;

export function translateWithFallback(t: SettingsTranslator, key: string, fallback: string): string {
  const translated = t(key);
  return translated === key ? fallback : translated;
}

export const SETTINGS_TABS: SettingsTabConfig[] = [
  {
    id: 'appearance',
    labelKey: 'settings.tab_appearance',
    labelFallback: 'Appearance',
  },
  {
    id: 'downloads',
    labelKey: 'settings.tab_downloads',
    labelFallback: 'Downloads',
  },
  {
    id: 'launcher',
    labelKey: 'settings.tab_launcher',
    labelFallback: 'Launcher',
  },
  {
    id: 'storage',
    labelKey: 'settings.tab_storage',
    labelFallback: 'Storage',
  },
  {
    id: 'accounts',
    labelKey: 'settings.tab_accounts',
    labelFallback: 'Accounts',
  },
  {
    id: 'statistics',
    labelKey: 'settings.tab_statistics',
    labelFallback: 'Statistics',
  },
];

export function getSettingsTabId(tabId: SettingsTabId): string {
  return `settings-tab-${tabId}`;
}

export function getSettingsTabLabelId(tabId: SettingsTabId): string {
  return `${getSettingsTabId(tabId)}-label`;
}

export function getSettingsPanelId(tabId: SettingsTabId): string {
  return `settings-panel-${tabId}`;
}

export function getSettingsTabConfig(tabId: SettingsTabId): SettingsTabConfig {
  return SETTINGS_TABS.find((tab) => tab.id === tabId) ?? SETTINGS_TABS[0];
}

export function getTranslatedSettingsTabConfig(
  tabId: SettingsTabId,
  t: SettingsTranslator,
): ResolvedSettingsTabConfig {
  const config = getSettingsTabConfig(tabId);

  return {
    ...config,
    label: translateWithFallback(t, config.labelKey, config.labelFallback),
  };
}

export function getTranslatedSettingsTabs(t: SettingsTranslator): ResolvedSettingsTabConfig[] {
  return SETTINGS_TABS.map((tab) => getTranslatedSettingsTabConfig(tab.id, t));
}
