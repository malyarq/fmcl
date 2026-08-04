import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { ModpackManifest } from '../../../shared/types/modpack';
import { assertChildName, resolvePathWithinRoot } from '../../security/pathGuards';
import { resolveApprovedInstancePath, getModpackDir, resolveLauncherRootPath } from '../instances/paths';
import { DownloadManager } from '../download/downloadManager';
import { downloadQueue } from '../download/downloadQueue';
import type { ContentManager } from '../content/contentManager';
import type { ModPlatformService } from './platform/modPlatformService';

export type ManifestInstallFailure = Readonly<{
  index: number;
  reason: 'content-install-failed';
}>;

type ManifestContentStore = Pick<ContentManager, 'getStorePath' | 'importFile' | 'linkFile'>;
type ManifestProviderPort = Pick<ModPlatformService, 'getCurseForgeClient' | 'getModrinthClient'>;

/** Installs provider-owned manifest entries into a caller-owned staged instance. */
export class ManifestContentInstaller {
  constructor(
    private readonly contentStore: ManifestContentStore,
    private readonly temporaryRoot = path.join(os.tmpdir(), 'fmcl-downloads'),
  ) {}

  public async install(
    rootPath: string,
    instanceId: string,
    manifest: ModpackManifest,
    providers: ManifestProviderPort,
  ): Promise<readonly ManifestInstallFailure[]> {
    const safeRootPath = resolveLauncherRootPath(rootPath);
    const safeInstanceId = assertChildName(instanceId, 'Instance id');
    const instancePath = resolveApprovedInstancePath(getModpackDir(safeRootPath, safeInstanceId));
    const modsDirectory = resolvePathWithinRoot(instancePath, 'mods', 'Mods directory');
    fs.mkdirSync(modsDirectory, { recursive: true });

    const failures: ManifestInstallFailure[] = [];
    for (const [index, entry] of manifest.files.entries()) {
      try {
        if (entry.projectID !== undefined && entry.fileID !== undefined) {
          const client = providers.getCurseForgeClient();
          if (!client) throw new Error('CurseForge client is unavailable');
          const file = await client.getModFile(entry.projectID, entry.fileID);
          if (!file.downloadUrl) throw new Error('CurseForge file has no download URL');
          const fileName = assertChildName(file.fileName, 'Mod file name');
          const sha1 = file.hashes?.find((hash) => hash.algo === 1)?.value;
          await this.installFile(file.downloadUrl, fileName, sha1, modsDirectory);
          continue;
        }

        if (entry.projectId !== undefined && entry.versionId !== undefined) {
          const version = await providers.getModrinthClient().getProjectVersion(entry.versionId);
          const file = version.files.find((candidate) => candidate.primary) ?? version.files[0];
          if (!file?.url) throw new Error('Modrinth version has no downloadable file');
          await this.installFile(
            file.url,
            assertChildName(file.filename, 'Mod file name'),
            file.hashes?.sha1,
            modsDirectory,
          );
          continue;
        }

        throw new Error('Manifest file does not identify a supported provider version');
      } catch (error) {
        console.warn('Failed to install manifest content:', error);
        failures.push({ index, reason: 'content-install-failed' });
      }
    }

    return failures;
  }

  private async installFile(
    url: string,
    fileName: string,
    sha1: string | undefined,
    modsDirectory: string,
  ): Promise<void> {
    const destination = resolvePathWithinRoot(modsDirectory, fileName, 'Mod file path');
    if (!sha1) {
      await downloadQueue.add(async () => {
        await DownloadManager.downloadSingle(url, destination);
      });
      return;
    }

    const cachedPath = this.contentStore.getStorePath(sha1);
    if (fs.existsSync(cachedPath)) {
      await this.contentStore.linkFile(destination, sha1);
      return;
    }

    fs.mkdirSync(this.temporaryRoot, { recursive: true });
    const extension = path.extname(fileName).slice(0, 16);
    const temporaryPath = resolvePathWithinRoot(
      this.temporaryRoot,
      assertChildName(`fmcl-${randomUUID()}${extension}`, 'Temporary mod file name'),
      'Temporary mod file path',
    );

    try {
      await downloadQueue.add(async () => {
        await DownloadManager.downloadSingle(url, temporaryPath, {
          checksum: { algorithm: 'sha1', hash: sha1 },
        });
      });
      await this.contentStore.importFile(temporaryPath, sha1, 'sha1');
      await this.contentStore.linkFile(destination, sha1);
    } finally {
      fs.rmSync(temporaryPath, { force: true });
    }
  }
}
