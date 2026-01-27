import type { MinecraftVersionList } from '@xmcl/installer';
import type { DownloadProviderId } from '../mirrors/providers';
import type { RuntimeDownloadService } from '../runtime/downloadService';

/**
 * Thin facade around RuntimeDownloadService for fetching Minecraft version manifest.
 *
 * Goal: keep LauncherManager as coordinator and avoid mixing list-fetch logic into it.
 */
export class VersionListService {
  constructor(private readonly downloads: RuntimeDownloadService) {}

  public async getVersionList(providerId?: DownloadProviderId): Promise<MinecraftVersionList> {
    const provider = this.downloads.getDownloadProvider(providerId);
    return await this.downloads.getVersionList(provider);
  }
}

