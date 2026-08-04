import type { DownloadProviderId } from '../mirrors/providers';

export type LaunchGameOptions = {
  nickname: string;
  version: string; // Identifier like "1.12.2" or "1.12.2-Forge"
  ram: number;
  hideLauncher?: boolean;
  instanceId?: string;
  downloadProvider?: DownloadProviderId;
  autoDownloadThreads?: boolean;
  downloadThreads?: number;
  maxSockets?: number;
  useOptiFine?: boolean;
};
