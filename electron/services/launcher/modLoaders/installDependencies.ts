import { Version } from '@xmcl/core';
import { installDependenciesTask } from '@xmcl/installer';
import type { DownloadProvider } from '../../mirrors/providers';
import type { TaskRunner } from '../../runtime/taskRunner';
import type { TaskProgressData } from '../types';
import { RuntimeDownloadService } from '../../runtime/downloadService';
import { getDependenciesWallClockTimeoutMs } from '../legacyCompatibility';

async function ensureAssetIndexUrl(params: {
  rootPath: string;
  fallbackMcVersion?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  resolved: any;
  onLog: (data: string) => void;
}) {
  const { rootPath, fallbackMcVersion, resolved, onLog } = params;

  const currentUrl = resolved?.assetIndex?.url;
  if (typeof currentUrl === 'string' && currentUrl.length > 0) return;

  // Prefer real base version. Some legacy Forge version JSONs do not set `inheritsFrom`.
  // In that case, use the Minecraft version we were asked to install for.
  const inheritsFrom = resolved?.inheritsFrom as string | undefined;
  const baseVersionId = inheritsFrom ?? fallbackMcVersion;
  if (!baseVersionId) return;

  // Important: Minecraft version manifest entries do NOT contain assetIndex.url.
  // For Forge-inherited versions, the correct assetIndex is in the local "inheritsFrom" vanilla version JSON.
  try {
    const baseResolved = await Version.parse(rootPath, baseVersionId);
    const url = baseResolved?.assetIndex?.url;
    if (typeof url === 'string' && url.length > 0) {
      resolved.assetIndex = { ...(baseResolved.assetIndex ?? {}), ...(resolved.assetIndex ?? {}), url };
      onLog(`[Assets] Patched missing assetIndex.url from local base version (base: ${baseVersionId})`);
      return;
    }
  } catch {
    // ignore and warn below
  }

  onLog(
    `[Assets] Warning: missing assetIndex.url (base: ${baseVersionId}). ` +
      `Try launching vanilla ${baseVersionId} once to download its version JSON, then retry.`
  );
}

export async function installDependencies(params: {
  rootPath: string;
  mcVersion: string;
  launchVersion: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  downloadOptions: any;
  downloadProvider: DownloadProvider;
  tasks: TaskRunner;
  onLog: (data: string) => void;
  onProgress: (data: TaskProgressData) => void;
}) {
  const { rootPath, mcVersion, launchVersion, downloadOptions, tasks, onLog, onProgress } = params;
  const resolved = await Version.parse(rootPath, launchVersion);

  // `installDependenciesTask` works with an already-resolved local version JSON (via `Version.parse`).
  // Passing custom `json/assetsIndexUrl` resolvers (built for remote manifest entries) can break
  // older/Forge-inherited versions where those URLs are intentionally missing.
  await ensureAssetIndexUrl({ rootPath, fallbackMcVersion: mcVersion, resolved, onLog });

  const safeOptions = { ...downloadOptions };
  delete safeOptions.json;
  delete safeOptions.client;
  delete safeOptions.server;

  const run = async () => {
    const depsTask = installDependenciesTask(resolved, safeOptions);
    // Some legacy versions (notably 1.5.2) can hang indefinitely on asset downloads without emitting progress.
    // Add a wall-clock watchdog so we can cancel and retry with different mirrors.
    const maxWallMs = getDependenciesWallClockTimeoutMs({ mcVersion });
    let timeout: NodeJS.Timeout | null = null;
    const timedOut = new Promise<never>((_, reject) => {
      timeout = setTimeout(() => {
        try {
          const cancellable = depsTask as unknown as { cancel?: () => void; abort?: () => void };
          if (typeof cancellable.cancel === 'function') cancellable.cancel();
          else if (typeof cancellable.abort === 'function') cancellable.abort();
        } catch {
          // ignore
        }
        reject(new Error(`Dependencies download timeout after ${Math.round(maxWallMs / 60_000)}m`));
      }, maxWallMs);
    });
    try {
      await Promise.race([tasks.runTaskWithProgress(depsTask, onProgress, onLog, `Installing dependencies for ${launchVersion}...`), timedOut]);
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  };

  try {
    await run();
  } catch (err: unknown) {
    // If we got stuck/cancelled on official hosts, force mirrors and retry once.
    const msg = err instanceof Error ? err.message : String(err);
    const looksLikeStall =
      /stuck|stall|no (byte )?progress|cancel|abort|timeout/i.test(msg);

    if (!looksLikeStall) throw err;
    if (params.downloadProvider.id === 'mojang') throw err;

    onLog(`[Dependencies] Detected stall/cancel (${msg}). Forcing mirrors and retrying once...`);

    // Blacklist official origins to push auto/bmcl providers onto mirrors.
    const downloads = (tasks as unknown as { downloads?: RuntimeDownloadService }).downloads;
    if (downloads && typeof downloads.blacklistOrigins === 'function') {
      downloads.blacklistOrigins(
        [
          'https://resources.download.minecraft.net',
          'https://libraries.minecraft.net',
          'https://piston-meta.mojang.com',
          'https://piston-data.mojang.com',
          'https://launchermeta.mojang.com',
          'https://maven.minecraftforge.net',
          'https://files.minecraftforge.net',
        ],
        onLog
      );
    } else {
      onLog('[Dependencies] Warning: cannot access download host blacklist; retrying anyway.');
    }

    await run();
  }
}

