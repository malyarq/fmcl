import type { Task } from '@xmcl/task';
import {
  getForgeVersionList,
  installForgeTask,
  type ForgeVersion,
} from '@xmcl/installer';
import path from 'node:path';
import fs from 'node:fs';

import type { DownloadProvider } from '../mirrors/providers';
import { orderCandidatesByScore } from '../mirrors/scoring';
import type { TaskProgressData } from './types';
import { ensureVersionInheritsFromBase, rewriteForgeInstallProfile, rewriteForgeVersionJson } from './forgePatches';
import { createForgeDispatcher } from './forge/createForgeDispatcher';
import { getForgeVersionFromPromotions, selectForgeVersion } from './forge/forgeVersionSelection';
import { ensureForgeMcpConfig } from './forge/mcpConfigRecovery';
import { DownloadManager } from '../download/downloadManager';
import { validateZipIntegrity } from '../download/zipValidator';
import { DEFAULT_USER_AGENT } from '@shared/constants';
import { BMCL_ROOT, BMCL_ROOT_FALLBACK } from '../mirrors/providers';

function isForgeInstallerSupportedMcVersion(versionId: string): boolean {
  const m = versionId.match(/^(\d+)\.(\d+)(?:\.(\d+))?$/);
  if (!m) return false;
  const major = Number(m[1]);
  const minor = Number(m[2]);
  if (!Number.isFinite(major) || !Number.isFinite(minor)) return false;
  return major > 1 || (major === 1 && minor >= 6);
}

function getForgeArtifactVersion(version: { mcversion: string; version: string }) {
  // Keep this logic in sync with @xmcl/installer `getForgeArtifactVersion`.
  // For MC 1.7+ (minor >= 7), Forge uses artifact version with MC version suffix.
  // Examples:
  // - 1.7.10 -> 1.7.10-10.13.4.1614-1.7.10
  // - 1.8.9 -> 1.8.9-11.15.1.2318-1.8.9
  // - 1.9.4 -> 1.9.4-12.17.0.2317-1.9.4
  // - 1.10 -> 1.10-12.18.0.2000-1.10.0 (no patch, so add .0)
  const [, minor] = version.mcversion.split('.');
  const minorVersion = Number.parseInt(minor, 10);
  if (minorVersion >= 7) {
    // If mcversion has no patch (e.g., "1.10"), add ".0" suffix.
    const parts = version.mcversion.split('.');
    const suffix = parts.length >= 3 ? version.mcversion : `${version.mcversion}.0`;
    return `${version.mcversion}-${version.version}-${suffix}`;
  }
  if (version.version.startsWith(version.mcversion)) {
    return version.version;
  }
  return `${version.mcversion}-${version.version}`;
}

async function prefetchForgeInstallerJar(params: {
  rootPath: string;
  version: { mcversion: string; version: string };
  provider: DownloadProvider;
  onLog: (data: string) => void;
}) {
  const { rootPath, version, provider, onLog } = params;
  const forgeArtifact = getForgeArtifactVersion(version);
  const fileName = `forge-${forgeArtifact}-installer.jar`;
  const rel = `net/minecraftforge/forge/${forgeArtifact}/${fileName}`;
  const destination = path.join(rootPath, 'libraries', ...rel.split('/'));

  // Use official URL as the base so mirror rewrite is correct (avoid double `/maven` issues).
  const officialUrl = `https://maven.minecraftforge.net/${rel}`;
  const providerUrls = provider.injectURLWithCandidates(officialUrl);

  // Prefer BMCL `/forge/download` for legacy builds: it often bypasses maven HTML placeholder pages.
  const bmclQuery = new URLSearchParams({
    mcversion: version.mcversion,
    version: version.version,
    category: 'installer',
    format: 'jar',
  });
  const bmclForge = `${BMCL_ROOT}/forge/download?${bmclQuery.toString()}`;
  const bmclForgeFallback = `${BMCL_ROOT_FALLBACK}/forge/download?${bmclQuery.toString()}`;
  const allUrls =
    provider.id === 'mojang' ? providerUrls : Array.from(new Set([bmclForge, bmclForgeFallback, ...providerUrls]));
  
  // Always include official URL as last resort (even if slow, it's most reliable)
  // Remove duplicates and ensure official URL is at the end
  const urlsWithOfficial = Array.from(new Set([...allUrls, officialUrl]));
  
  // Use scoring to prioritize fast mirrors (especially important for users in Russia/China)
  // But keep official URL at the end as ultimate fallback
  const scoredUrls = orderCandidatesByScore(urlsWithOfficial.filter(url => url !== officialUrl));
  const urls = [...scoredUrls, officialUrl];

  // Check if file already exists and is valid before attempting download
  if (fs.existsSync(destination)) {
    try {
      const stats = fs.statSync(destination);
      if (stats.size > 0) {
        // File exists and has content, validate it
        await validateZipIntegrity(destination);
        onLog(`[Forge] Installer jar already exists and is valid (${stats.size} bytes), skipping prefetch`);
        return;
      } else {
        // File is empty, delete it
        onLog(`[Forge] Existing installer jar is empty, deleting...`);
        fs.unlinkSync(destination);
      }
    } catch {
      // File is corrupted, delete it
      onLog(`[Forge] Existing installer jar is corrupted, deleting...`);
      try {
        fs.unlinkSync(destination);
      } catch {
        // Ignore deletion errors
      }
    }
  }

  onLog(`[Forge] Prefetching installer jar (${fileName}) via ${urls.length} URLs (prioritized by performance, official URL as fallback)...`);
  try {
    await DownloadManager.downloadSingle(urls, destination, {
      validateZip: true,
      retryCount: 3, // Increased from 1 to 3 - give mirrors more chances, especially for network hiccups
      maxRedirections: 5,
      maxSockets: 4, // Increased from 2 to 4 for better parallelization
      headers: {
        'user-agent': DEFAULT_USER_AGENT,
        accept: '*/*',
        'accept-encoding': 'identity',
      },
    });
    onLog('[Forge] Installer prefetch ✓');
  } catch (prefetchError: unknown) {
    const msg = prefetchError instanceof Error ? prefetchError.message : String(prefetchError);
    // Log detailed error info if available
    if (prefetchError instanceof Error && 'errors' in prefetchError && Array.isArray((prefetchError as { errors?: unknown }).errors)) {
      const errors = (prefetchError as { errors?: Error[] }).errors ?? [];
      const errorDetails = errors.map((e, i) => {
        const url = (e as Error & { url?: string }).url ?? 'unknown';
        const urlShort = url.length > 80 ? `${url.substring(0, 77)}...` : url;
        return `(${i + 1}/${errors.length}) ${e.message} [${urlShort}]`;
      }).join(' | ');
      onLog(`[Forge] Installer prefetch failed (will let XMCL retry): ${errorDetails}`);
    } else {
      onLog(`[Forge] Installer prefetch failed (will let XMCL retry): ${msg}`);
    }
    // Don't throw - let XMCL retry with its own download mechanism
  }
}

export async function installForge(options: {
  rootPath: string;
  mcVersion: string;
  javaPath: string;
  downloadProvider: DownloadProvider;
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
  const { rootPath, mcVersion, javaPath, downloadProvider, downloadOptions, onLog, onProgress, runTaskWithProgress } =
    options;

  // Allow legacy Forge installs (e.g. 1.5.2) even if they may fail depending on upstream installer format.
  // The launcher should attempt installation and surface the real upstream error instead of blocking early.
  if (!isForgeInstallerSupportedMcVersion(mcVersion)) {
    onLog(`[Forge] WARNING: legacy Minecraft version detected (${mcVersion}). Forge installation may fail depending on installer format.`);
  }

  onLog('Resolving Forge version...');
  let forgeVersion: ForgeVersion | { mcversion: string; version: string };
  try {
    const forgeList = await getForgeVersionList({ minecraft: mcVersion });
    forgeVersion = selectForgeVersion(mcVersion, forgeList);
    const forgeType = 'type' in forgeVersion ? forgeVersion.type : 'custom';
    onLog(`Installing Forge ${mcVersion}-${forgeVersion.version} (${forgeType})...`);
  } catch (e: unknown) {
    const errorMsg = e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : String(e);
    onLog(`[Forge] Version list failed: ${errorMsg ?? e}.`);
    forgeVersion = await getForgeVersionFromPromotions(mcVersion, onLog);
    onLog(`Installing Forge ${mcVersion}-${forgeVersion.version} (promotions)...`);
  }

  const forgeVersionId = `${mcVersion}-forge-${forgeVersion.version}`;
  const runForgeInstall = async () => {
    // Best-effort: prefetch installer jar with our hardened downloader (HTML/ZIP checks).
    // This mitigates flaky mirrors returning truncated/HTML content which breaks older Forge installers.
    if ('mcversion' in forgeVersion && typeof forgeVersion.mcversion === 'string') {
      await prefetchForgeInstallerJar({ rootPath, version: forgeVersion, provider: downloadProvider, onLog });
    }

    const forgeDispatcher = createForgeDispatcher();
    const forgeTask = installForgeTask(forgeVersion as ForgeVersion, rootPath, {
      ...(downloadOptions as Record<string, unknown>),
      java: javaPath,
      // Help upstream downloader avoid HTML placeholders / challenges.
      headers: {
        'user-agent': DEFAULT_USER_AGENT,
        accept: '*/*',
        'accept-encoding': 'identity',
      },
      // Override dispatcher for Forge to reduce long "silent" stalls.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      dispatcher: forgeDispatcher as any,
      mavenHost: downloadProvider.injectURLWithCandidates('https://maven.minecraftforge.net/'),
    });
    let profilePatched = false;
    let mcpPrefetchStarted = false;
    return await runTaskWithProgress(
      forgeTask,
      onProgress,
      onLog,
      'Forge installation',
      'Forge',
      (t) => {
        if (profilePatched) return;
        if (t.path.includes('installForge.library')) {
          const patchedProfile = rewriteForgeInstallProfile(rootPath, forgeVersionId, downloadProvider, onLog);
          const patchedVersion = rewriteForgeVersionJson(rootPath, forgeVersionId, downloadProvider, onLog);
          profilePatched = patchedProfile || patchedVersion;

          // Best-effort: start mcp_config prefetch ASAP to avoid multi-minute stalls.
          // Do NOT await (we don't want to block task scheduler), but log outcome.
          if (!mcpPrefetchStarted) {
            mcpPrefetchStarted = true;
            onLog('[Forge] Prefetching mcp_config in background (to prevent stalls)...');
            ensureForgeMcpConfig({ rootPath, versionId: forgeVersionId, provider: downloadProvider, onLog })
              .then((ok) => {
                if (ok) onLog('[Forge] mcp_config prefetch ✓');
              })
              .catch((e: unknown) => {
                const msg = e instanceof Error ? e.message : String(e);
                onLog(`[Forge] mcp_config prefetch failed (will retry on error): ${msg}`);
              });
          }
        }
      }
    );
  };

  try {
    const launchVersion = await runForgeInstall();
    // Critical for legacy Forge: ensure base jar is on classpath by setting inheritsFrom.
    ensureVersionInheritsFromBase(rootPath, launchVersion, mcVersion, onLog);
    onLog(`[Forge] ✓ Installed successfully!`);
    onLog(`[Forge] Version ID: ${launchVersion}`);
    onLog(`[Forge] Forge version: ${forgeVersion.version}`);
    return launchVersion;
  } catch (err: unknown) {
    const errorMsg = err && typeof err === 'object' && 'message' in err ? String((err as { message: unknown }).message) : String(err);
    
    // Log detailed error info if available (from DownloadManager)
    let detailedError = errorMsg;
    if (err instanceof Error && 'errors' in err && Array.isArray((err as { errors?: unknown }).errors)) {
      const errors = (err as { errors?: Error[] }).errors ?? [];
      if (errors.length > 0) {
        const errorDetails = errors.map((e, i) => {
          const url = (e as Error & { url?: string }).url ?? 'unknown';
          const urlShort = url.length > 80 ? `${url.substring(0, 77)}...` : url;
          return `(${i + 1}/${errors.length}) ${e.message} [${urlShort}]`;
        }).join(' | ');
        detailedError = errorDetails;
      }
    }
    
    // Check if error is related to checksum validation (corrupted files)
    const isChecksumError = detailedError.includes('checksum') || detailedError.includes('sha1') || detailedError.includes('hash');
    const isEmptyFileError = detailedError.includes('empty') || detailedError.includes('0 bytes') || detailedError.includes('da39a3ee5e6b4b0d3255bfef95601890afd80709');
    const isZipCorruptionError = detailedError.includes('end of central directory') || detailedError.includes('Invalid or unsupported zip format') || detailedError.includes('corrupted or incomplete download');
    
    if (isEmptyFileError) {
      onLog(`[Forge] WARNING: Mirror returned an empty file (SHA1: da39a3ee5e6b4b0d3255bfef95601890afd80709).`);
      onLog(`[Forge] This indicates the mirror is not serving the file correctly.`);
      onLog(`[Forge] The launcher will retry with different mirrors.`);
    } else if (isZipCorruptionError) {
      onLog(`[Forge] WARNING: Downloaded ZIP file is corrupted or incomplete.`);
      onLog(`[Forge] This usually means the mirror returned a truncated or invalid file.`);
      onLog(`[Forge] Possible causes: network interruption, mirror issues, or rate limiting.`);
      onLog(`[Forge] The launcher will retry with different mirrors (including official source).`);
    } else if (isChecksumError) {
      onLog(`[Forge] WARNING: Checksum validation failed - some files may be corrupted.`);
      onLog(`[Forge] This usually indicates that mirrors returned empty or corrupted files.`);
      onLog(`[Forge] The launcher will retry with different mirrors.`);
    }
    
    onLog(`[Forge] Library download failed: ${detailedError}`);
    onLog('[Forge] Attempting mcp_config fallback recovery...');
    try {
      const recovered = await ensureForgeMcpConfig({ rootPath, versionId: forgeVersionId, provider: downloadProvider, onLog });
      if (recovered) {
        onLog('[Forge] mcp_config recovered, retrying installation...');
        onLog('[Forge] NOTE: Retry will attempt to download from different mirrors.');
        return await runForgeInstall();
      }
      onLog('[Forge] mcp_config recovery failed, throwing original error');
      throw err;
    } catch (recoveryError: unknown) {
      const recoveryMsg =
        recoveryError && typeof recoveryError === 'object' && 'message' in recoveryError
          ? String((recoveryError as { message: unknown }).message)
          : String(recoveryError);
      onLog(`[Forge] Recovery attempt failed: ${recoveryMsg ?? recoveryError}`);
      throw err;
    }
  }
}
