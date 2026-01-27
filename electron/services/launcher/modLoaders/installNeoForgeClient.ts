import type { DownloadProvider } from '../../mirrors/providers';
import type { TaskRunner } from '../../runtime/taskRunner';
import { getNeoForgeVersion } from '../../versions/versionResolver';
import type { TaskProgressData } from '../types';
import { installNeoForge } from '../neoforgeInstaller';

export async function installNeoForgeClient(params: {
  rootPath: string;
  mcVersion: string;
  javaPath: string;
  downloadProvider: DownloadProvider;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  downloadOptions: any;
  tasks: TaskRunner;
  onLog: (data: string) => void;
  onProgress: (data: TaskProgressData) => void;
}) {
  const { rootPath, mcVersion, javaPath, downloadProvider, downloadOptions, tasks, onLog, onProgress } = params;

  onLog('Resolving NeoForge version...');
  const neoForgeVersion = await getNeoForgeVersion(mcVersion, onLog);
  if (!neoForgeVersion) {
    throw new Error(`NeoForge is not available for Minecraft ${mcVersion}`);
  }

  try {
    return await installNeoForge({
      rootPath,
      mcVersion,
      neoForgeVersion,
      downloadProvider,
      javaPath,
      onLog,
      onProgress,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      downloadOptions: downloadOptions as any,
      runTaskWithProgress: tasks.runTaskWithProgress.bind(tasks),
    });
  } catch (err: unknown) {
    const errorMsg = err && typeof err === 'object' && 'message' in err ? String((err as { message: unknown }).message) : String(err);
    onLog(`[NeoForge] Installation failed: ${errorMsg ?? err}`);
    throw err;
  }
}

