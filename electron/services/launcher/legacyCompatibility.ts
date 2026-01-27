import fs from 'node:fs';
import path from 'node:path';
import type { DownloadProvider } from '../mirrors/providers';
import { DownloadManager } from '../download/downloadManager';
import { DEFAULT_USER_AGENT } from '@shared/constants';
import { ensureVersionInheritsFromBase } from './forgePatches';

type Semverish = { major: number; minor: number; patch: number };

function parseMcVersion(mcVersion: string): Semverish | null {
  const m = mcVersion.match(/^(\d+)\.(\d+)(?:\.(\d+))?$/);
  if (!m) return null;
  const major = Number(m[1]);
  const minor = Number(m[2]);
  const patch = Number(m[3] ?? 0);
  if (![major, minor, patch].every((n) => Number.isFinite(n))) return null;
  return { major, minor, patch };
}

function isAtMost(a: Semverish, b: Semverish) {
  if (a.major !== b.major) return a.major < b.major;
  if (a.minor !== b.minor) return a.minor < b.minor;
  return a.patch <= b.patch;
}

function isLegacyForgeRuntimeDownloadsLikely(mcVersion: string): boolean {
  // FML runtime-download behavior is mostly a pre-1.6 era pain point (HTTP + checksum).
  // Keep this rule broad and future-proof (range-based), not per exact patch.
  const v = parseMcVersion(mcVersion);
  if (!v) return false;
  if (v.major !== 1) return false;
  return isAtMost(v, { major: 1, minor: 5, patch: 2 });
}

export function getDependenciesWallClockTimeoutMs(params: { mcVersion: string }) {
  const { mcVersion } = params;
  // Older assets endpoints/flows sometimes emit no progress for long periods.
  // Keep shorter watchdog for very old versions, otherwise default.
  return isLegacyForgeRuntimeDownloadsLikely(mcVersion) ? 15 * 60_000 : 30 * 60_000;
}

/**
 * Ensure Forge version JSON has correct inheritance metadata so the base Minecraft jar ends up on the classpath.
 */
export function patchForgeVersionMetadata(params: {
  rootPath: string;
  launchVersion: string;
  mcVersion: string;
  onLog: (data: string) => void;
}) {
  const { rootPath, launchVersion, mcVersion, onLog } = params;
  ensureVersionInheritsFromBase(rootPath, launchVersion, mcVersion, onLog);
}

type LegacyRuntimeFile = {
  fileName: string;
  sha1: string;
  relativeUrl: string; // relative to /fmllibs/
};

// Data-driven table: checksum is inherently version-specific, but kept centralized here (not scattered in flow).
const LEGACY_FMLLIBS: Record<string, LegacyRuntimeFile[]> = {
  '1.5.2': [
    {
      fileName: 'deobfuscation_data_1.5.2.zip',
      sha1: '446e55cd986582c70fcf12cb27bc00114c5adfd9',
      relativeUrl: 'deobfuscation_data_1.5.2.zip',
    },
  ],
};

/**
 * Prefetch files that legacy Forge/FML attempts to download at runtime into `<instance>/lib`.
 * This prevents checksum failures caused by HTTP mirrors returning incorrect payloads.
 */
export async function prefetchLegacyForgeRuntimeDeps(params: {
  instancePath: string;
  mcVersion: string;
  downloadProvider: DownloadProvider;
  onLog: (data: string) => void;
}) {
  const { instancePath, mcVersion, downloadProvider, onLog } = params;
  if (!isLegacyForgeRuntimeDownloadsLikely(mcVersion)) return;

  const files = LEGACY_FMLLIBS[mcVersion];
  if (!files || files.length === 0) return;

  const libDir = path.join(instancePath, 'lib');
  try {
    fs.mkdirSync(libDir, { recursive: true });
  } catch {
    // ignore
  }

  for (const item of files) {
    const destination = path.join(libDir, item.fileName);
    const httpsOfficial = `https://files.minecraftforge.net/fmllibs/${item.relativeUrl}`;
    const httpOfficial = `http://files.minecraftforge.net/fmllibs/${item.relativeUrl}`;
    const multimc = `https://files.multimc.org/fmllibs/${item.relativeUrl}`;
    const bmcl = `https://bmclapi.bangbang93.com/fmllibs/${item.relativeUrl}`;
    const bmcl2 = `https://bmclapi2.bangbang93.com/fmllibs/${item.relativeUrl}`;
    const providerCandidates = downloadProvider.injectURLWithCandidates(httpsOfficial);
    const urls = Array.from(new Set([httpsOfficial, multimc, bmcl, bmcl2, ...providerCandidates, httpOfficial]));

    onLog(`[Forge] Prefetching legacy runtime dep: ${item.fileName}...`);
    await DownloadManager.downloadSingle(urls, destination, {
      checksum: { algorithm: 'sha1', hash: item.sha1 },
      validateZip: true,
      retryCount: 3,
      maxRedirections: 5,
      maxSockets: 2,
      headers: { 'user-agent': DEFAULT_USER_AGENT, accept: '*/*', 'accept-encoding': 'identity' },
    });
    onLog(`[Forge] Prefetch ✓ ${item.fileName}`);
  }
}

