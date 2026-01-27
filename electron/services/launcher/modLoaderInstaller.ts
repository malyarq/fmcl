import type { DownloadProvider } from '../mirrors/providers';
import type { TaskRunner } from '../runtime/taskRunner';
import type { TaskProgressData } from './types';
import { installFabricClient } from './modLoaders/installFabricClient';
import { installForgeClient } from './modLoaders/installForgeClient';
import { installNeoForgeClient } from './modLoaders/installNeoForgeClient';
import { installDependencies } from './modLoaders/installDependencies';
import { installOptifineMod } from './modLoaders/installOptifineMod';

export async function installModLoaderIfNeeded(params: {
  rootPath: string;
  instancePath: string;
  mcVersion: string;
  javaPath: string;
  requestedVersion: string;
  isForge: boolean;
  isNeoForge: boolean;
  isFabric: boolean;
  useOptiFine: boolean | undefined;
  downloadProvider: DownloadProvider;
  maxSockets: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  downloadOptions: any;
  tasks: TaskRunner;
  onLog: (data: string) => void;
  onProgress: (data: TaskProgressData) => void;
}): Promise<string> {
  const {
    rootPath,
    instancePath,
    mcVersion,
    javaPath,
    requestedVersion,
    isForge,
    isNeoForge,
    isFabric,
    useOptiFine,
    downloadProvider,
    maxSockets,
    downloadOptions,
    tasks,
    onLog,
    onProgress,
  } = params;

  let launchVersion = mcVersion;

  if (isFabric) {
    launchVersion = await installFabricClient({ rootPath, mcVersion, downloadOptions, onLog, onProgress });
  } else if (isForge) {
    launchVersion = await installForgeClient({
      rootPath,
      mcVersion,
      javaPath,
      downloadProvider,
      downloadOptions,
      tasks,
      onLog,
      onProgress,
    });
  } else if (isNeoForge) {
    launchVersion = await installNeoForgeClient({
      rootPath,
      mcVersion,
      javaPath,
      downloadProvider,
      downloadOptions,
      tasks,
      onLog,
      onProgress,
    });
  }

  await installDependencies({ rootPath, mcVersion, launchVersion, downloadOptions, downloadProvider, tasks, onLog, onProgress });

  if (useOptiFine) {
    await installOptifineMod({ instancePath, mcVersion, downloadProvider, maxSockets, onLog, onProgress });
  }

  onLog('═══════════════════════════════════════════════════════════');
  onLog(`[LAUNCH INFO] Final version for launch: ${launchVersion} (requested: ${requestedVersion})`);
  onLog('═══════════════════════════════════════════════════════════');

  return launchVersion;
}

