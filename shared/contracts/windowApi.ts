import type { AppUpdaterAPI } from './appUpdater';
import type { AssetsAPI } from './assets';
import type { CacheAPI } from './cache';
import type { InstanceUpdaterAPI } from './updater';
import type { IpcRendererAPI } from './ipcRenderer';
import type { ModpacksAPI } from './modpacks';
import type { LauncherAPI } from './launcher';
import type { ModsAPI } from './mods';
import type { NetworkAPI } from './network';
import type { SettingsAPI } from './settings';
import type { WindowControlsAPI } from './windowControls';

/**
 * Unified, namespaced preload surface (preferred for new code).
 *
 * The legacy `window.*` globals remain supported for backward compatibility.
 */
export type FriendLauncherApi = {
  launcher: LauncherAPI;
  modpacks: ModpacksAPI;
  mods: ModsAPI;
  updater: InstanceUpdaterAPI;
  windowControls: WindowControlsAPI;
  network: NetworkAPI;
  cache: CacheAPI;
  settings: SettingsAPI;
  assets: AssetsAPI;
  appUpdater: AppUpdaterAPI;
  ipcRenderer: IpcRendererAPI;
};

