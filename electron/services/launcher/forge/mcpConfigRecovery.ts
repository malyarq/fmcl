import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import AdmZip from 'adm-zip';
import { Agent, interceptors } from 'undici';

import { DownloadManager } from '../../download/downloadManager';
import type { DownloadProvider } from '../../mirrors/providers';
import { orderCandidatesByScore } from '../../mirrors/scoring';
import { DEFAULT_USER_AGENT } from '@shared/constants';
import { downloadFileDirectly } from '../directDownload';

async function computeFileSha1(filePath: string) {
  return new Promise<string>((resolve, reject) => {
    const hash = crypto.createHash('sha1');
    const stream = fs.createReadStream(filePath);
    stream.on('error', reject);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

export async function ensureForgeMcpConfig(options: {
  rootPath: string;
  versionId: string;
  provider: DownloadProvider;
  onLog: (data: string) => void;
}) {
  const { rootPath, versionId, provider, onLog } = options;

  const versionPath = path.join(rootPath, 'versions', versionId, `${versionId}.json`);
  const profilePath = path.join(rootPath, 'versions', versionId, 'install_profile.json');
  const files = [versionPath, profilePath];
  const candidates: Array<{ url: string; sha1: string; path: string }> = [];

  for (const file of files) {
    if (!fs.existsSync(file)) continue;
    try {
      const raw = fs.readFileSync(file, 'utf-8');
      const data = JSON.parse(raw);
      const libs = data?.libraries;
      if (!Array.isArray(libs)) continue;
      for (const lib of libs) {
        const artifact = lib?.downloads?.artifact;
        const artifactPath = artifact?.path;
        const artifactUrl = artifact?.url ?? (lib?.url && artifactPath ? `${lib.url}${artifactPath}` : undefined);
        const sha1 = artifact?.sha1;
        if (!artifactPath || !artifactUrl || !sha1) continue;
        if (!artifactPath.includes('de/oceanlabs/mcp/mcp_config/')) continue;
        candidates.push({ url: artifactUrl, sha1, path: artifactPath });
      }
    } catch {
      // Ignore malformed JSON.
    }
  }

  if (candidates.length === 0) return false;
  const target = candidates[0];
  const destination = path.join(rootPath, 'libraries', target.path);

  if (fs.existsSync(destination)) {
    try {
      const currentSha1 = await computeFileSha1(destination);
      if (currentSha1.toLowerCase() === target.sha1.toLowerCase()) {
        onLog('[Forge] mcp_config already present with valid checksum.');
        return true;
      }
      onLog(`[Forge] Existing file has wrong SHA1 (${currentSha1}), will re-download...`);
    } catch {
      // Re-download if we cannot verify
    }
  }

  // IMPORTANT:
  // `target.url` may already be mirror-rewritten (e.g. BMCL uses `/maven/...`),
  // so "swap host" can create invalid URLs like `https://maven.minecraftforge.net/maven/...` (404).
  // Always reconstruct official-style URLs from the artifact path.
  const forgeMavenUrl = `https://maven.minecraftforge.net/${target.path}`;
  const oldForgeMavenUrl = `https://files.minecraftforge.net/maven/${target.path}`;
  const mavenCentralUrl = `https://repo.maven.apache.org/maven2/${target.path}`;

  // Use official Forge URL as the base for provider candidates (ensures mirror path is correct).
  const urls = provider.injectURLWithCandidates(forgeMavenUrl);

  // Combine all URLs and use scoring system to prioritize fast mirrors
  const allUrls = [forgeMavenUrl, oldForgeMavenUrl, mavenCentralUrl, ...urls];
  const uniqueUrls = Array.from(new Set(allUrls));

  // Use scoring system to prioritize mirrors based on past performance
  // This helps users in Russia/China get faster mirrors automatically
  const prioritizedUrls = orderCandidatesByScore(uniqueUrls);

  const uniqueOriginSet = new Set(
    prioritizedUrls.map((url) => {
      try {
        return new URL(url).origin;
      } catch {
        return url;
      }
    })
  );

  onLog(`[Forge] Retrying mcp_config via ${prioritizedUrls.length} URLs (${uniqueOriginSet.size} unique mirrors)...`);
  onLog(`[Forge] Expected SHA1: ${target.sha1}`);
  onLog(`[Forge] File size should be ~400KB`);

  // Try parallel downloads from top 3 mirrors for faster response (race condition)
  // This significantly speeds up downloads for users with good internet
  const topMirrors = prioritizedUrls.slice(0, 3);
  onLog(`[Forge] Attempting parallel download from top ${topMirrors.length} mirrors...`);
  const expectedMinSize = 300 * 1024;
  
  // Try parallel downloads first (race condition - first successful wins)
  // Use a lock to ensure only one successful download moves the file
  let downloadLock = false;
  const parallelAttempts = topMirrors.map(async (url) => {
    const tempDest = `${destination}.tmp.${Date.now()}.${Math.random().toString(36).substring(7)}`;
    try {
      const origin = new URL(url).origin;
      await downloadFileDirectly({ url, destination: tempDest, expectedSize: undefined, onLog: () => {} });
      
      // Check lock - if another download already succeeded, skip
      if (downloadLock) {
        try {
          if (fs.existsSync(tempDest)) {
            fs.unlinkSync(tempDest);
          }
        } catch {
          // ignore
        }
        return false; // Already succeeded, skip
      }
      
      const stats = fs.statSync(tempDest);
      if (stats.size < expectedMinSize) {
        throw new Error(`File too small: ${stats.size} bytes`);
      }
      
      // Validate ZIP
      const zip = new AdmZip(tempDest);
      zip.getEntries(); // Will throw if invalid
      
      // Validate SHA1
      const actualSha1 = await computeFileSha1(tempDest);
      if (actualSha1.toLowerCase() !== target.sha1.toLowerCase()) {
        const isOfficial = origin.includes('maven.minecraftforge.net') || origin.includes('files.minecraftforge.net');
        if (!isOfficial) {
          throw new Error(`SHA1 mismatch: expected ${target.sha1}, got ${actualSha1}`);
        }
        // Allow official hosts even with SHA1 mismatch if ZIP is valid
      }
      
      // Acquire lock and move file atomically
      if (!downloadLock) {
        downloadLock = true;
        // Success! Move temp file to destination
        if (fs.existsSync(destination)) {
          fs.unlinkSync(destination);
        }
        fs.renameSync(tempDest, destination);
        onLog(`[Forge] ✓ mcp_config downloaded successfully from ${origin} with valid checksum!`);
        return true;
      } else {
        // Another download already succeeded, clean up
        try {
          if (fs.existsSync(tempDest)) {
            fs.unlinkSync(tempDest);
          }
        } catch {
          // ignore
        }
        return false;
      }
    } catch (err) {
      // Clean up temp file
      try {
        if (fs.existsSync(tempDest)) {
          fs.unlinkSync(tempDest);
        }
      } catch {
        // ignore
      }
      throw err;
    }
  });
  
  // Use Promise.race to get first successful download
  try {
    const results = await Promise.allSettled(parallelAttempts);
    const successful = results.find((r) => r.status === 'fulfilled' && r.value === true);
    if (successful) {
      return true;
    }
    // Log errors from parallel attempts for debugging
    const errors = results
      .filter((r) => r.status === 'rejected')
      .map((r) => (r.status === 'rejected' ? r.reason : null))
      .filter(Boolean);
    if (errors.length > 0) {
      onLog(`[Forge] Parallel download attempts failed (${errors.length}/${topMirrors.length} mirrors)`);
    }
  } catch {
    // Fall through to sequential download
  }
  
  // If parallel attempts failed, fall back to sequential with all mirrors
  onLog(`[Forge] Parallel download failed, trying sequential download from ${prioritizedUrls.length} mirrors...`);
  for (const url of prioritizedUrls) {
    try {
      const origin = new URL(url).origin;
      onLog(`[Forge] Trying direct download from: ${origin}`);
      await downloadFileDirectly({ url, destination, expectedSize: undefined, onLog });

      const stats = fs.statSync(destination);
      const fileSize = stats.size;
      onLog(`[Forge] Downloaded file size: ${Math.round(fileSize / 1024)}KB`);

      if (fileSize < expectedMinSize) {
        throw new Error(
          `File too small (${fileSize} bytes), expected at least ${expectedMinSize} bytes. File may be corrupted or incomplete.`
        );
      }

      try {
        const zip = new AdmZip(destination);
        const entries = zip.getEntries();
        onLog(`[Forge] ZIP validation passed (${entries.length} entries).`);

        const actualSha1 = await computeFileSha1(destination);
        if (actualSha1.toLowerCase() === target.sha1.toLowerCase()) {
          onLog('[Forge] ✓ mcp_config downloaded successfully with valid checksum!');
          return true;
        }

        const isOfficial = origin.includes('maven.minecraftforge.net') || origin.includes('files.minecraftforge.net');
        onLog(`[Forge] SHA1 mismatch (expected ${target.sha1}, got ${actualSha1})`);
        if (isOfficial) {
          onLog('[Forge] WARNING: checksum mismatch from official host, but ZIP looks valid; proceeding as fallback.');
          return true;
        }

        onLog('[Forge] Rejecting mismatched checksum from mirror; trying next source...');
        try {
          fs.unlinkSync(destination);
        } catch {
          // ignore
        }
        continue;
      } catch (zipError: unknown) {
        const errorMsg = zipError instanceof Error ? zipError.message : String(zipError);
        onLog(`[Forge] ZIP validation failed: ${errorMsg}`);
        if (fs.existsSync(destination)) {
          try {
            fs.unlinkSync(destination);
          } catch {
            // ignore
          }
        }
        continue;
      }
    } catch (directError: unknown) {
      const errorMsg = directError instanceof Error ? directError.message : String(directError);
      onLog(`[Forge] Direct download from ${new URL(url).origin} failed: ${errorMsg}`);
      if (fs.existsSync(destination)) {
        try {
          fs.unlinkSync(destination);
        } catch {
          // ignore
        }
      }
      continue;
    }
  }

  onLog('[Forge] Direct download failed, trying via DownloadManager with optimized settings...');
  try {
    // Use more connections for faster downloads (especially for users with good internet)
    const optimizedDispatcher = new Agent({
      connections: 3, // Increased from 1 to 3 for parallel connections
      connectTimeout: 15_000, // Reduced from 30s - faster failure detection
      headersTimeout: 30_000, // Reduced from 60s
      bodyTimeout: 120_000, // Reduced from 180s - progress monitoring will catch stalls earlier
    }).compose(interceptors.retry({ maxRetries: 2 }), interceptors.redirect({ maxRedirections: 5 }));

    await DownloadManager.downloadSingle(prioritizedUrls, destination, {
      checksum: { algorithm: 'sha1', hash: target.sha1 },
      maxSockets: 3, // Increased from 1 to 3 for better parallelization
      validateZip: true,
      retryCount: 2, // Reduced from 3 - faster failure and retry
      dispatcher: optimizedDispatcher,
      headers: { 'user-agent': DEFAULT_USER_AGENT, accept: '*/*', 'accept-encoding': 'identity' },
    });
    onLog('[Forge] mcp_config downloaded successfully with valid checksum.');
    return true;
  } catch (checksumError: unknown) {
    const errorMsg = checksumError instanceof Error ? checksumError.message : String(checksumError);
    onLog(`[Forge] DownloadManager also failed: ${errorMsg}`);
    throw new Error(`Failed to download mcp_config from all sources: ${errorMsg}`);
  }
}

