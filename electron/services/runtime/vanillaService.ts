import { installTask as installMinecraftTask, type MinecraftVersion } from '@xmcl/installer';
import type { TaskProgressData } from '@shared/types';
import type { DownloadProvider } from '../mirrors/providers';
import { RuntimeDownloadService } from './downloadService';
import { TaskRunner } from './taskRunner';

/**
 * Vanilla install / version metadata concerns.
 *
 * Step-1 note:
 * - Uses XMCL `getVersionList()` (via RuntimeDownloadService) and `installTask`.
 * - `installTask` is idempotent; it should not re-download intact files and can repair broken ones.
 */
export class VanillaService {
  constructor(
    private readonly downloads: RuntimeDownloadService,
    private readonly tasks: TaskRunner
  ) {}

  private async resolveVersionMeta(versionId: string, provider: DownloadProvider): Promise<MinecraftVersion> {
    const list = await this.downloads.getVersionList(provider);
    const found = list.versions.find((v) => v.id === versionId);
    if (!found) {
      throw new Error(`Minecraft version ${versionId} not found in version manifest.`);
    }
    return found;
  }

  public async ensureVanillaInstalled(
    versionId: string,
    rootPath: string,
    onLog: (data: string) => void,
    onProgress: (data: TaskProgressData) => void,
    provider: DownloadProvider,
    downloadOptions: Record<string, unknown>
  ) {
    const versionMeta = await this.resolveVersionMeta(versionId, provider);

    const task = installMinecraftTask(versionMeta, rootPath, downloadOptions);
    await this.tasks.runTaskWithProgress(task, onProgress, onLog, `Installing Minecraft ${versionId}...`);
  }
}

