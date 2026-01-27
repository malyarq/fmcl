import type { DownloadProviderId } from '../types';
import type { TaskProgressData } from '../types';

export interface LauncherLaunchOptions {
  nickname: string;
  version: string;
  ram: number;
  hideLauncher?: boolean;
  gamePath?: string;
  modpackId?: string;
  modpackPath?: string;
  javaPath?: string;
  downloadProvider?: DownloadProviderId;
  autoDownloadThreads?: boolean;
  downloadThreads?: number;
  maxSockets?: number;
  useOptiFine?: boolean;
  // Legacy aliases for backward compatibility
  instanceId?: string;
  instancePath?: string;
}

export interface LauncherVersionListResponse {
  versions: Array<{
    id: string;
    type: string;
    url: string;
    time: string;
    releaseTime: string;
  }>;
}

export type LauncherProgressEvent = TaskProgressData;

/**
 * Core launcher API (launch + versions + events).
 *
 * Mods and Modpacks are exposed via dedicated domain APIs:
 * - `window.mods` (see `shared/contracts/mods.ts`)
 * - `window.modpacks` (see `shared/contracts/modpacks.ts`)
 *
 * Note: runtime may still provide legacy aliases on `window.launcher`,
 * but they are intentionally NOT part of this type.
 */
export interface LauncherAPI {
  launch: (options: LauncherLaunchOptions) => Promise<void>;
  getVersionList: (providerId?: DownloadProviderId) => Promise<LauncherVersionListResponse>;
  getForgeSupportedVersions: (providerId?: DownloadProviderId) => Promise<string[]>;
  getFabricSupportedVersions: () => Promise<string[]>;
  getOptiFineSupportedVersions: () => Promise<string[]>;
  getNeoForgeSupportedVersions: (providerId?: DownloadProviderId) => Promise<string[]>;

  onLog: (callback: (log: string) => void) => () => void;
  onProgress: (callback: (progress: LauncherProgressEvent) => void) => () => void;
  onClose: (callback: (code: number) => void) => () => void;
}

