/// <reference types="vite/client" />

import type {
  AppUpdaterAPI,
  AssetsAPI,
  CacheAPI,
  InstanceUpdaterAPI,
  IpcRendererAPI,
  ModpacksAPI,
  MirrorsAPI,
  LauncherAPI,
  ModsAPI,
  NetworkAPI,
  SettingsAPI,
  WindowControlsAPI,
  FriendLauncherApi,
  AccountAPI,
  ExternalLinksAPI,
} from '@shared/contracts';
import type { ShareAPI } from '@shared/contracts/share';

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
    account: AccountAPI;
    mirrors: MirrorsAPI;
    share: ShareAPI;
    externalLinks: ExternalLinksAPI;

    // Supported surface for renderer code (namespaced).
    api: FriendLauncherApi;
  }
}

export { };
