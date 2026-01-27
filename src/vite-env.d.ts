/// <reference types="vite/client" />

import type {
  AppUpdaterAPI,
  AssetsAPI,
  CacheAPI,
  InstanceUpdaterAPI,
  IpcRendererAPI,
  ModpacksAPI,
  LauncherAPI,
  ModsAPI,
  NetworkAPI,
  SettingsAPI,
  WindowControlsAPI,
  FriendLauncherApi,
} from '@shared/contracts';

declare global {
  interface Window {
    launcher: LauncherAPI;
    modpacks: ModpacksAPI;
    mods: ModsAPI;
    updater: InstanceUpdaterAPI;
    windowControls: WindowControlsAPI;
    networkAPI: NetworkAPI;
    cache: CacheAPI;
    settings: SettingsAPI;
    assets: AssetsAPI;
    appUpdater: AppUpdaterAPI;
    ipcRenderer: IpcRendererAPI;

    // Preferred surface for new code (namespaced).
    api: FriendLauncherApi;
  }
}

export {};
