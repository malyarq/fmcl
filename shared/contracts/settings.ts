export type SettingsBackupValues = Readonly<Record<string, string>>;

const SETTINGS_BACKUP_EXACT_KEYS = new Set([
  'nickname',
  'sidebar_collapsed',
  'simple_play_welcome_dismissed',
  'onboarding_completed',
  'first_launch',
  'mp_mode',
  'mp_host_port',
  'settings_hideLauncher',
  'settings_language',
  'settings_appearanceState',
  'settings_downloadProvider',
  'settings_autoDownloadThreads',
  'settings_downloadThreads',
  'settings_maxSockets',
  'settings_uiScale',
  'settings_disableAnimations',
  'settings_sidebarPosition',
  'settings_compactMode',
  'settings_uiMode',
  'settings_ram',
  'settings_networkMode',
  'settings_theme',
  'settings_accentColor',
  'settings_customTheme',
  'settings_themePresetId',
]);

export function isSettingsBackupKey(key: string): boolean {
  return key.startsWith('lastGame_') || SETTINGS_BACKUP_EXACT_KEYS.has(key);
}

export type SettingsBackupExportResult = Readonly<{
  canceled: boolean;
  fileName?: string;
}>;

export type SettingsBackupImportResult = Readonly<{
  canceled: boolean;
  fileName?: string;
  values?: SettingsBackupValues;
}>;

export interface SettingsAPI {
  selectMinecraftPath: () => Promise<{ success: boolean; path: string | null; error?: string }>;
  openMinecraftPath: (path?: string) => Promise<{ success: boolean; error?: string }>;
  getDefaultMinecraftPath: () => Promise<string>;
  exportBackup: (values: SettingsBackupValues) => Promise<SettingsBackupExportResult>;
  importBackup: () => Promise<SettingsBackupImportResult>;
}
