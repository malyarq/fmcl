import fs from 'fs';
import path from 'path';
import { DownloadManager } from '../download/downloadManager';
import { DEFAULT_USER_AGENT } from '@shared/constants';
import type { TaskProgressData } from './types';
import type { DownloadProvider } from '../mirrors/providers';
import { getOptiFineVersion } from '../versions/versionResolver';

export async function installOptiFineAsMod(
  instancePath: string,
  mcVersion: string,
  provider: DownloadProvider,
  maxSockets: number,
  onLog: (data: string) => void,
  onProgress: (data: TaskProgressData) => void
) {
  const modsPath = path.join(instancePath, 'mods');
  try {
    fs.mkdirSync(modsPath, { recursive: true });
  } catch {
    // Directory already exists
  }

  const optiFineVersion = await getOptiFineVersion(mcVersion, onLog);
  if (!optiFineVersion) {
    onLog(`[OptiFine] Skipping installation - no version available for Minecraft ${mcVersion}`);
    return;
  }

  let normalizedVersion = mcVersion;
  if (normalizedVersion === '1.9' || normalizedVersion === '1.8') {
    normalizedVersion += '.0';
  }

  const fileName = `OptiFine_${mcVersion}_${optiFineVersion.type}_${optiFineVersion.patch}.jar`;
  const modFilePath = path.join(modsPath, fileName);

  if (fs.existsSync(modFilePath)) {
    onLog(`[OptiFine] ✓ Already installed: ${fileName}`);
    onLog(`[OptiFine] Path: ${modFilePath}`);
    return;
  }

  const downloadUrl = `https://bmclapi2.bangbang93.com/optifine/${normalizedVersion}/${optiFineVersion.type}/${optiFineVersion.patch}`;
  const urls = provider.injectURLWithCandidates(downloadUrl);

  onLog(`[OptiFine] Downloading ${fileName}...`);
  onProgress({ type: 'OptiFine', task: 0, total: 100 });

  await DownloadManager.downloadSingle(urls, modFilePath, {
    maxSockets,
    validateZip: true,
    headers: { 'user-agent': DEFAULT_USER_AGENT, accept: '*/*', 'accept-encoding': 'identity' },
  });

  onLog(`[OptiFine] ✓ Successfully installed: ${fileName}`);
  onLog(`[OptiFine] Path: ${modFilePath}`);
  onProgress({ type: 'OptiFine', task: 100, total: 100 });
}

