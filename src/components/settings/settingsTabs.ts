export type SettingsTabId = 'appearance' | 'downloads' | 'launcher' | 'storage' | 'accounts' | 'statistics';

export type SettingsTabConfig = {
  id: SettingsTabId;
  labelKey: string;
  labelFallback: string;
  descriptionKey: string;
  descriptionFallback: string;
  panelHintKey: string;
  panelHintFallback: string;
};

export type ResolvedSettingsTabConfig = SettingsTabConfig & {
  label: string;
  description: string;
  panelHint: string;
};

type SettingsTranslator = (key: string) => string;

function translateWithFallback(t: SettingsTranslator, key: string, fallback: string): string {
  const translated = t(key);
  return translated === key ? fallback : translated;
}

export const SETTINGS_TABS: SettingsTabConfig[] = [
  {
    id: 'appearance',
    labelKey: 'settings.tab_appearance',
    labelFallback: 'Appearance',
    descriptionKey: 'settings.theme_presets_desc',
    descriptionFallback: 'Apply a ready-made visual profile, or import/export your own configuration.',
    panelHintKey: 'settings.doneHint',
    panelHintFallback: 'Changes are saved automatically as you work.',
  },
  {
    id: 'downloads',
    labelKey: 'settings.tab_downloads',
    labelFallback: 'Downloads',
    descriptionKey: 'settings.downloadsHint',
    descriptionFallback: 'Tune mirrors, concurrency, and connection limits for a stable download pipeline.',
    panelHintKey: 'settings.downloadsHint',
    panelHintFallback: 'Tune mirrors, concurrency, and connection limits for a stable download pipeline.',
  },
  {
    id: 'launcher',
    labelKey: 'settings.tab_launcher',
    labelFallback: 'Launcher',
    descriptionKey: 'settings.launcherHint',
    descriptionFallback: 'Manage runtime behavior, update checks, and persistent launcher caches from one place.',
    panelHintKey: 'settings.launcherHint',
    panelHintFallback: 'Manage runtime behavior, update checks, and persistent launcher caches from one place.',
  },
  {
    id: 'storage',
    labelKey: 'settings.tab_storage',
    labelFallback: 'Storage',
    descriptionKey: 'settings.storage.description',
    descriptionFallback: 'Review shared content usage and run cleanup without digging through extra utility panels.',
    panelHintKey: 'settings.storage.description',
    panelHintFallback: 'Review shared content usage and run cleanup without digging through extra utility panels.',
  },
  {
    id: 'accounts',
    labelKey: 'settings.tab_accounts',
    labelFallback: 'Accounts',
    descriptionKey: 'accounts.description',
    descriptionFallback: 'Keep your launch-ready accounts, provider access, and skin tools in one place.',
    panelHintKey: 'accounts.description',
    panelHintFallback: 'Keep your launch-ready accounts, provider access, and skin tools in one place.',
  },
  {
    id: 'statistics',
    labelKey: 'settings.tab_statistics',
    labelFallback: 'Statistics',
    descriptionKey: 'stats.description',
    descriptionFallback: 'Keep the most useful launch and play-time trends visible without opening extra sections.',
    panelHintKey: 'stats.description',
    panelHintFallback: 'Keep the most useful launch and play-time trends visible without opening extra sections.',
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

export function getTranslatedSettingsTabConfig(
  tabId: SettingsTabId,
  t: SettingsTranslator,
): ResolvedSettingsTabConfig {
  const config = getSettingsTabConfig(tabId);

  return {
    ...config,
    label: translateWithFallback(t, config.labelKey, config.labelFallback),
    description: translateWithFallback(t, config.descriptionKey, config.descriptionFallback),
    panelHint: translateWithFallback(t, config.panelHintKey, config.panelHintFallback),
  };
}

export function getTranslatedSettingsTabs(t: SettingsTranslator): ResolvedSettingsTabConfig[] {
  return SETTINGS_TABS.map((tab) => getTranslatedSettingsTabConfig(tab.id, t));
}
