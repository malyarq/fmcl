import type { DownloadProvider } from '../../mirrors/providers';
import type { TaskProgressData } from '../types';
import { installOptiFineAsMod as installOptiFineAsModImpl } from '../optifineInstaller';

export async function installOptifineMod(params: {
  instancePath: string;
  mcVersion: string;
  downloadProvider: DownloadProvider;
  maxSockets: number;
  onLog: (data: string) => void;
  onProgress: (data: TaskProgressData) => void;
}) {
  const { instancePath, mcVersion, downloadProvider, maxSockets, onLog, onProgress } = params;

  try {
    await installOptiFineAsModImpl(instancePath, mcVersion, downloadProvider, maxSockets, onLog, onProgress);
  } catch (e: unknown) {
    const errorMsg = e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : String(e);
    onLog(`[OptiFine] Installation failed: ${errorMsg ?? e}. Continuing without OptiFine...`);
  }
}

