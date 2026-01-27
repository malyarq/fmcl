import type { Task } from '@xmcl/task';
import { installNeoForgedTask } from '@xmcl/installer';
import type { DownloadProvider } from '../mirrors/providers';
import type { TaskProgressData } from './types';

export async function installNeoForge(options: {
  rootPath: string;
  mcVersion: string;
  neoForgeVersion: string;
  downloadProvider: DownloadProvider;
  javaPath: string;
  downloadOptions: Record<string, unknown>;
  onLog: (data: string) => void;
  onProgress: (data: TaskProgressData) => void;
  runTaskWithProgress: <T>(
    task: Task<T>,
    onProgress: (data: TaskProgressData) => void,
    onLog: (data: string) => void,
    label: string,
    overrideType?: string,
    onSubtaskStart?: (task: Task) => void
  ) => Promise<T>;
}): Promise<string> {
  const { rootPath, mcVersion, neoForgeVersion, downloadProvider, javaPath, downloadOptions, onLog, onProgress, runTaskWithProgress } = options;

  /**
   * Step-2: NeoForge installer is fully delegated to XMCL.
   * - No manual jar download/extract/exec.
   * - The returned value is the installed versionId to be used with Version.parse(rootPath, versionId).
   */
  onLog(`Installing NeoForge for Minecraft ${mcVersion} (NeoForge ${neoForgeVersion})...`);
  onProgress({ type: 'NeoForge', task: 0, total: 100 });

  const task = installNeoForgedTask('neoforge', neoForgeVersion, rootPath, {
    ...(downloadOptions as Record<string, unknown>),
    java: javaPath,
    // NeoForge artifacts come from its Maven; provider will inject mirrors when available.
    mavenHost: downloadProvider.injectURLWithCandidates('https://maven.neoforged.net/releases/'),
  });

  const installedVersionId = await runTaskWithProgress(
    task,
    onProgress,
    onLog,
    'NeoForge installation',
    'NeoForge'
  );

  onLog(`[NeoForge] ✓ Installed successfully!`);
  onLog(`[NeoForge] Version ID: ${installedVersionId}`);
  onLog(`[NeoForge] NeoForge version: ${neoForgeVersion}`);
  onProgress({ type: 'NeoForge', task: 100, total: 100 });
  return installedVersionId;
}

