import type { DownloadProvider } from '../../mirrors/providers';
import type { TaskRunner } from '../../runtime/taskRunner';
import type { TaskProgressData } from '../types';
import { installForge } from '../forgeInstaller';

export async function installForgeClient(params: {
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

  return await installForge({
    rootPath,
    mcVersion,
    javaPath,
    downloadProvider,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    downloadOptions: downloadOptions as any,
    onLog,
    onProgress,
    runTaskWithProgress: tasks.runTaskWithProgress.bind(tasks),
  });
}

