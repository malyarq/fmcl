import type { DownloadProviderId } from '../mirrors/providers';

export type LaunchGameOptions = {
  nickname: string;
  version: string; // Identifier like "1.12.2" or "1.12.2-Forge"
  ram: number;
  hideLauncher?: boolean;
  gamePath?: string;
  modpackId?: string;
  modpackPath?: string;
  javaPath?: string;
  vmOptions?: string[];
  downloadProvider?: DownloadProviderId;
  autoDownloadThreads?: boolean;
  downloadThreads?: number;
  maxSockets?: number;
  useOptiFine?: boolean;
  // Legacy aliases for backward compatibility
  instanceId?: string;
  instancePath?: string;
};

