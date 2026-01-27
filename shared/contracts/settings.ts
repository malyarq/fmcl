export interface SettingsAPI {
  selectMinecraftPath: () => Promise<{ success: boolean; path: string | null; error?: string }>;
  openMinecraftPath: (path?: string) => Promise<{ success: boolean; error?: string }>;
  getDefaultMinecraftPath: () => Promise<string>;
}

