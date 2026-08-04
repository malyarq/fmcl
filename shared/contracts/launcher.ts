import type { DownloadProviderId } from '../types';
import type { TaskProgressData } from '../types';

export interface LauncherLaunchOptions {
  nickname: string;
  version: string;
  ram: number;
  hideLauncher?: boolean;
  instanceId?: string;
  downloadProvider?: DownloadProviderId;
  autoDownloadThreads?: boolean;
  downloadThreads?: number;
  maxSockets?: number;
  useOptiFine?: boolean;
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
 * Mods and instance/provider capabilities are exposed via dedicated domain APIs:
 * - `window.api.mods` (see `shared/contracts/mods.ts`)
 * - `window.api.instances` and `window.api.providerCatalog`
 *
 * The renderer reaches this contract through `window.api.launcher` only.
 */
export interface LauncherAPI {
  launch: (options: LauncherLaunchOptions) => Promise<void>;
  killAndRestart: () => Promise<void>;
  getVersionList: (providerId?: DownloadProviderId) => Promise<LauncherVersionListResponse>;
  getForgeSupportedVersions: (providerId?: DownloadProviderId) => Promise<string[]>;
  getFabricSupportedVersions: () => Promise<string[]>;
  getOptiFineSupportedVersions: () => Promise<string[]>;
  getNeoForgeSupportedVersions: (providerId?: DownloadProviderId) => Promise<string[]>;
  sendStdin: (data: string) => Promise<void>;

  onLog: (callback: (log: string) => void) => () => void;
  onProgress: (callback: (progress: LauncherProgressEvent) => void) => () => void;
  onClose: (callback: (code: number) => void) => () => void;
}
