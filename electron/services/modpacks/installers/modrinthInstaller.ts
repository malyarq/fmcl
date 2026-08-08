import path from 'node:path';
import type { ModrinthV2Client } from '@xmcl/modrinth';
import { parseModrinthManifest } from '../parsers/modrinthParser';
import { assertChildName, resolvePathWithinRoot } from '../../../security/pathGuards';
import type { ModpackConfig, ModLoaderType } from '../../instances/types';
import type { ProviderArchivePort, ProviderContentPort, ProviderDownloadPort, ProviderStagedInstall } from '.';

export type ModrinthInstallerPorts = Readonly<{
  provider: Pick<ModrinthV2Client, 'getProjectVersion' | 'getProject'>;
  download: ProviderDownloadPort;
  archive: ProviderArchivePort;
  content: ProviderContentPort;
}>;

export type ModrinthStagingInput = Readonly<{
  projectId: string;
  versionId: string;
  destinationId: string;
  stagingRoot: string;
  checkCancelled?: () => void;
}>;

/** Downloads provider content into the caller-owned staging workspace only. */
export async function stageModrinthModpack(ports: ModrinthInstallerPorts, input: ModrinthStagingInput): Promise<ProviderStagedInstall> {
  const checkCancelled = () => input.checkCancelled?.();
  checkCancelled();
  const version = await ports.provider.getProjectVersion(input.versionId);
  const packFile = version.files?.find((file) => file.filename.endsWith('.mrpack')) ?? version.files?.[0];
  if (!packFile?.url) throw new Error('Modrinth modpack version has no download URL');
  const project = await ports.provider.getProject(input.projectId);
  const temporaryDirectory = ports.content.createTemporaryDirectory('burrow-modrinth-');
  const stagePath = resolvePathWithinRoot(input.stagingRoot, `modpacks/${input.destinationId}`, 'Modrinth staged modpack');
  const archivePath = path.join(temporaryDirectory, 'modpack.mrpack');
  const extractPath = path.join(temporaryDirectory, 'extracted');
  try {
    await ports.download.download({ urls: [packFile.url], destination: archivePath, sha1: packFile.hashes?.sha1, label: 'Modrinth modpack download URL' });
    checkCancelled();
    await ports.archive.extract(archivePath, extractPath, 'Modrinth modpack');
    checkCancelled();
    const manifestPath = resolvePathWithinRoot(extractPath, 'modrinth.index.json', 'Modrinth manifest');
    if (!ports.content.exists(manifestPath)) throw new Error('Modrinth modpack does not contain modrinth.index.json');
    const manifest = parseModrinthManifest(ports.content.readText(manifestPath));
    const minecraft = version.game_versions?.[0];
    if (!minecraft) throw new Error('Modrinth modpack version has no Minecraft version');
    const loader = primaryLoader(version.loaders ?? []);
    const config = configFor(input.destinationId, manifest.name || project.title, minecraft, loader);
    ports.content.ensureDirectory(stagePath);
    ports.content.writeText(resolvePathWithinRoot(stagePath, 'modpack.json', 'Modrinth staged config'), JSON.stringify(config));
    const missing: Array<{ path: string; reason: string }> = [];
    for (const file of manifest.files) {
      const filePath = file.path || '';
      try {
        checkCancelled();
        if (!filePath) throw new Error('provider file path is missing');
        if (!file.downloads?.length) throw new Error('provider did not return a download URL');
        const destination = resolvePathWithinRoot(stagePath, filePath, 'Modrinth provider file destination');
        ports.content.ensureDirectory(path.dirname(destination));
        await ports.download.download({ urls: file.downloads, destination, sha1: file.hashes?.sha1, label: `Modrinth file ${filePath} download URL` });
        checkCancelled();
      } catch (error) {
        if (file.required) throw error;
        missing.push({ path: filePath || 'missing-path', reason: error instanceof Error ? error.message : 'optional provider download failed' });
      }
    }
    copyDirectory(ports.content, resolvePathWithinRoot(extractPath, 'overrides', 'Modrinth overrides'), stagePath, checkCancelled);
    ports.content.copyFile(manifestPath, resolvePathWithinRoot(stagePath, 'modrinth.index.json', 'Modrinth staged manifest'));
    return {
      config,
      source: { source: 'modrinth', sourceId: input.projectId, sourceVersionId: input.versionId, version: version.version_number ?? version.name, description: project.description, iconUrl: project.icon_url },
      content: { instanceId: input.destinationId, descriptor: 'modrinth.index.json' },
      missing,
    };
  } finally {
    ports.content.removeDirectory(temporaryDirectory);
  }
}

function configFor(id: string, name: string, minecraft: string, modLoader: { type: ModLoaderType; version?: string }): ModpackConfig {
  const now = new Date().toISOString();
  return { id, name: name.trim() || id, runtime: { minecraft, modLoader }, memory: { maxMb: 4096 }, vmOptions: [], createdAt: now, updatedAt: now };
}

function primaryLoader(loaders: readonly string[]): { type: ModLoaderType; version?: string } {
  const type = (['forge', 'fabric', 'quilt', 'neoforge'] as const).find((candidate) => loaders.includes(candidate));
  return { type: type ?? 'vanilla' };
}

function copyDirectory(content: ProviderContentPort, source: string, destination: string, checkCancelled: () => void): void {
  if (!content.exists(source)) return;
  for (const entry of content.readDirectory(source)) {
    checkCancelled();
    const safeName = assertChildName(entry.name, 'Modrinth override entry');
    const sourcePath = resolvePathWithinRoot(source, safeName, 'Modrinth override source');
    const destinationPath = resolvePathWithinRoot(destination, safeName, 'Modrinth override destination');
    if (entry.directory) { content.ensureDirectory(destinationPath); copyDirectory(content, sourcePath, destinationPath, checkCancelled); }
    else content.copyFile(sourcePath, destinationPath);
  }
}
