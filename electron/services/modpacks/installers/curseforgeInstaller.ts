import path from 'node:path';
import type { CurseforgeV1Client } from '@xmcl/curseforge';
import { parseCurseForgeManifest } from '../parsers/curseforgeParser';
import { assertChildName, resolvePathWithinRoot } from '../../../security/pathGuards';
import type { ModpackConfig, ModLoaderType } from '../../instances/types';
import type { ProviderArchivePort, ProviderContentPort, ProviderDownloadPort, ProviderStagedInstall } from '.';

export type CurseForgeInstallerPorts = Readonly<{
  provider: Pick<CurseforgeV1Client, 'getModFile' | 'getMod'>;
  download: ProviderDownloadPort;
  archive: ProviderArchivePort;
  content: ProviderContentPort;
}>;

export type CurseForgeStagingInput = Readonly<{
  projectId: number;
  fileId: number;
  destinationId: string;
  stagingRoot: string;
  checkCancelled?: () => void;
}>;

/** Downloads provider content into the caller-owned staging workspace only. */
export async function stageCurseForgeModpack(ports: CurseForgeInstallerPorts, input: CurseForgeStagingInput): Promise<ProviderStagedInstall> {
  const checkCancelled = () => input.checkCancelled?.();
  checkCancelled();
  const packFile = await ports.provider.getModFile(input.projectId, input.fileId);
  if (!packFile.downloadUrl) throw new Error('CurseForge modpack file has no downloadUrl');
  const pack = await ports.provider.getMod(input.projectId);
  const temporaryDirectory = ports.content.createTemporaryDirectory('burrow-curseforge-');
  const stagePath = resolvePathWithinRoot(input.stagingRoot, `modpacks/${input.destinationId}`, 'CurseForge staged modpack');
  const archivePath = path.join(temporaryDirectory, 'modpack.zip');
  const extractPath = path.join(temporaryDirectory, 'extracted');
  try {
    await ports.download.download({ urls: [packFile.downloadUrl], destination: archivePath, sha1: packFile.hashes?.find((hash) => hash.algo === 1)?.value, label: 'CurseForge modpack download URL' });
    checkCancelled();
    await ports.archive.extract(archivePath, extractPath, 'CurseForge modpack');
    checkCancelled();
    const manifestPath = resolvePathWithinRoot(extractPath, 'manifest.json', 'CurseForge manifest');
    if (!ports.content.exists(manifestPath)) throw new Error('CurseForge modpack does not contain manifest.json');
    const manifest = parseCurseForgeManifest(ports.content.readText(manifestPath));
    const loader = parseLoader(manifest.minecraft.modLoaders.find((entry) => entry.primary)?.id ?? manifest.minecraft.modLoaders[0]?.id);
    const config = configFor(input.destinationId, manifest.name || pack.name, manifest.minecraft.version, loader);
    ports.content.ensureDirectory(stagePath);
    ports.content.writeText(resolvePathWithinRoot(stagePath, 'modpack.json', 'CurseForge staged config'), JSON.stringify(config));
    const missing: Array<{ path: string; reason: string }> = [];
    const modsPath = resolvePathWithinRoot(stagePath, 'mods', 'CurseForge staged mods');
    ports.content.ensureDirectory(modsPath);
    for (const file of manifest.files) {
      const missingPath = `curseforge:${file.projectID ?? 'missing'}/${file.fileID ?? 'missing'}`;
      if (!file.projectID || !file.fileID) {
        if (file.required) throw new Error(`Required CurseForge file is missing identifiers: ${missingPath}`);
        missing.push({ path: missingPath, reason: 'provider file identifiers are missing' });
        continue;
      }
      try {
        checkCancelled();
        const mod = await ports.provider.getModFile(file.projectID, file.fileID);
        if (!mod.downloadUrl) throw new Error('provider did not return a download URL');
        const destination = resolvePathWithinRoot(modsPath, assertChildName(mod.fileName ?? `${file.fileID}.jar`, 'CurseForge mod filename'), 'CurseForge mod destination');
        await ports.download.download({ urls: [mod.downloadUrl], destination, sha1: mod.hashes?.find((hash) => hash.algo === 1)?.value, label: `CurseForge mod ${file.projectID}/${file.fileID} download URL` });
        checkCancelled();
      } catch (error) {
        if (file.required) throw error;
        missing.push({ path: missingPath, reason: error instanceof Error ? error.message : 'optional provider download failed' });
      }
    }
    copyDirectory(ports.content, resolvePathWithinRoot(extractPath, manifest.overrides || 'overrides', 'CurseForge overrides'), stagePath, checkCancelled);
    ports.content.copyFile(manifestPath, resolvePathWithinRoot(stagePath, 'manifest.json', 'CurseForge staged manifest'));
    return {
      config,
      source: { source: 'curseforge', sourceId: String(input.projectId), sourceVersionId: String(input.fileId), version: manifest.version, description: pack.summary, iconUrl: pack.logo?.thumbnailUrl, author: manifest.author ?? (pack.authors?.map((author) => author.name ?? '').filter(Boolean).join(', ') || undefined) },
      content: { instanceId: input.destinationId, descriptor: 'manifest.json' },
      missing,
    };
  } finally {
    ports.content.removeDirectory(temporaryDirectory);
  }
}

function configFor(id: string, name: string, minecraft: string, modLoader?: { type: ModLoaderType; version?: string }): ModpackConfig {
  const now = new Date().toISOString();
  return { id, name: name.trim() || id, runtime: { minecraft, ...(modLoader === undefined ? {} : { modLoader }) }, memory: { maxMb: 4096 }, vmOptions: [], createdAt: now, updatedAt: now };
}

function parseLoader(id?: string): { type: ModLoaderType; version?: string } | undefined {
  if (!id) return undefined;
  const match = /^(forge|fabric|quilt|neoforge)(?:-(.+))?$/i.exec(id);
  return match ? { type: match[1].toLowerCase() as ModLoaderType, ...(match[2] === undefined ? {} : { version: match[2] }) } : { type: 'vanilla' };
}

function copyDirectory(content: ProviderContentPort, source: string, destination: string, checkCancelled: () => void): void {
  if (!content.exists(source)) return;
  for (const entry of content.readDirectory(source)) {
    checkCancelled();
    const safeName = assertChildName(entry.name, 'CurseForge override entry');
    const sourcePath = resolvePathWithinRoot(source, safeName, 'CurseForge override source');
    const destinationPath = resolvePathWithinRoot(destination, safeName, 'CurseForge override destination');
    if (entry.directory) { content.ensureDirectory(destinationPath); copyDirectory(content, sourcePath, destinationPath, checkCancelled); }
    else content.copyFile(sourcePath, destinationPath);
  }
}
