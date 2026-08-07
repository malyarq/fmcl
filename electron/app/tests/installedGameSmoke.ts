import type { LauncherRoot, CanonicalInstanceRecord } from '../../domains/instances/instanceTypes';
import { createLaunchAdapters } from '../../infrastructure/instances/launchAdapters';
import type { JavaManager } from '../../services/java/provisioning';
import { LauncherManager } from '../../services/launcher/orchestrator';
import type { DownloadProviderId } from '../../services/mirrors/providers';
import type { RuntimeDownloadService } from '../../services/runtime/downloadService';
import type { TaskRunner } from '../../services/runtime/taskRunner';
import type { VanillaService } from '../../services/runtime/vanillaService';
import type { VersionListService } from '../../services/versions/versionListService';
import { runGameLaunchSmoke } from './gameLaunchSmoke';
import type { TestSummary } from './types';

type LaunchResult = NonNullable<TestSummary['launch']>;

type InstalledGameSmokeParams = {
  version: string | null;
  rootPath: string;
  javaManager: JavaManager;
  downloads: RuntimeDownloadService;
  versionLists: VersionListService;
  tasks: TaskRunner;
  vanilla: VanillaService;
  providerId: DownloadProviderId;
  authServerUrl?: string;
  onLog(line: string): void;
};

function createLauncher(params: {
  rootPath: string;
  version: string;
  javaManager: JavaManager;
  downloads: RuntimeDownloadService;
  versionLists: VersionListService;
  tasks: TaskRunner;
  vanilla: VanillaService;
  authServerUrl?: string;
}): LauncherManager {
  const { rootPath, version, javaManager, downloads, versionLists, tasks, vanilla, authServerUrl } = params;
  const root = rootPath as unknown as LauncherRoot;
  const now = new Date().toISOString();
  const record: CanonicalInstanceRecord = {
    id: 'game-smoke',
    name: 'Game smoke',
    source: { source: 'local', createdAt: now, updatedAt: now },
    config: {
      runtime: { minecraftVersion: version, modLoader: { type: 'vanilla' } },
      memory: { minMb: 1024, maxMb: 2048 },
      game: { resolution: { width: 854, height: 480 } },
    },
    summary: { minecraftVersion: version, modLoader: { type: 'vanilla' } },
  };
  return new LauncherManager({
    javaManager,
    downloads,
    versionLists,
    tasks,
    vanilla,
    instances: { read: async () => ({ status: 'ready', snapshot: { selectedId: record.id, records: [record] } }) },
    rootResolver: {
      resolve: async (input) => {
        if (input !== rootPath) throw new Error('Game smoke received an unexpected launcher root');
        return root;
      },
    },
    launchAdapters: createLaunchAdapters(),
    launcherRootPath: rootPath,
    authServerUrl,
  });
}

export async function runInstalledGameSmoke(params: InstalledGameSmokeParams): Promise<LaunchResult> {
  const { version, onLog } = params;
  if (!version) return { requested: true, version: null, ok: false, ms: 0, signals: [], error: 'No installed vanilla version is available for the launch smoke' };

  onLog('═══════════════════════════════════════════════════════════');
  onLog(`[GameSmoke] Launching Minecraft ${version} through the production launcher path...`);
  const result = await runGameLaunchSmoke({
    launcher: createLauncher({ ...params, version }),
    version,
    providerId: params.providerId,
    onLog,
  });
  onLog(`[GameSmoke] ${result.ok ? 'PASS' : 'FAIL'} (${result.ms}ms; signals=${result.signals.join(',') || 'none'})`);
  if (result.error) onLog(`[GameSmoke] Error: ${result.error}`);
  return { requested: true, ...result };
}

export async function runOptionalInstalledGameSmoke(
  params: InstalledGameSmokeParams & { requested: boolean },
): Promise<TestSummary['launch']> {
  if (!params.requested) return undefined;
  return runInstalledGameSmoke(params);
}

export function getLaunchFailureCount(launch: TestSummary['launch']): number {
  return launch && !launch.ok ? 1 : 0;
}
