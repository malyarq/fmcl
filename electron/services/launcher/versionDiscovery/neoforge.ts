import type { DownloadProviderId } from '../../mirrors/providers';
import type { VersionEntry } from '../types';

export async function discoverNeoForgeSupportedVersions(params: {
  getVersionList: (providerId?: DownloadProviderId) => Promise<{ versions: VersionEntry[] }>;
  providerId?: DownloadProviderId;
}): Promise<string[]> {
  const { getVersionList, providerId } = params;

  console.log('[NeoForge] Starting to fetch supported versions...');
  const startTime = Date.now();
  try {
    console.log('[NeoForge] Fetching Minecraft version list...');
    const versionList = await getVersionList(providerId);
    const releaseVersions = (versionList.versions as VersionEntry[]).filter((v: VersionEntry) => v.type === 'release');
    console.log(`[NeoForge] Found ${releaseVersions.length} release versions to check`);

    const supportedVersions: string[] = [];

    // NeoForge only supports Minecraft 1.20.1 and newer
    // Filter to only check modern versions to speed up
    const modernVersions = releaseVersions.filter((v: VersionEntry) => {
      const parts = v.id.split('.');
      if (parts.length < 2) return false;
      const major = parseInt(parts[0], 10);
      const minor = parseInt(parts[1], 10);
      const patch = parts[2] ? parseInt(parts[2], 10) : 0;
      // Check for 1.20.1+ or 1.21+
      if (major === 1 && minor === 20) {
        return patch >= 1; // 1.20.1+
      }
      return (major === 1 && minor >= 21) || major > 1;
    });

    console.log(
      `[NeoForge] Filtered to ${modernVersions.length} modern versions (1.20.1+) out of ${releaseVersions.length} total`
    );
    console.log('[NeoForge] Checking all versions in parallel via BMCLAPI...');

    // Concurrency-limited checks with reasonable timeout
    const concurrencyLimit = 8;
    const results: Array<string | null> = [];
    let idx = 0;
    const worker = async () => {
      while (true) {
        const current = idx++;
        if (current >= modernVersions.length) return;
        const version = modernVersions[current];
        try {
          const bmclUrl = `https://bmclapi2.bangbang93.com/neoforge/list/${version.id}`;
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 2000); // Increased timeout to 2s

          const response = await fetch(bmclUrl, {
            signal: controller.signal,
            cache: 'no-store',
          });
          clearTimeout(timeoutId);

          if (response.ok) {
            const data = await response.json();
            // BMCL API returns array of objects with version info
            if (data && Array.isArray(data) && data.length > 0) {
              results[current] = version.id;
            } else {
              results[current] = null;
            }
          } else {
            if (current < 3) {
              console.log(`[NeoForge] HTTP ${response.status} for ${version.id}`);
            }
            results[current] = null;
          }
        } catch (e: unknown) {
          results[current] = null;
          // Log errors for debugging (only first few to avoid spam)
          if (current < 3) {
            const errorMsg = e instanceof Error ? e.message : String(e);
            console.log(`[NeoForge] Error checking ${version.id}: ${errorMsg}`);
          }
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(concurrencyLimit, modernVersions.length) }, () => worker()));
    const found = results.filter((r) => r !== null) as string[];
    supportedVersions.push(...found);

    if (found.length > 0) {
      console.log(`[NeoForge] Found ${found.length} supported versions: ${found.join(', ')}`);
    }

    const elapsed = Date.now() - startTime;
    console.log(`[NeoForge] Completed: found ${supportedVersions.length} supported versions in ${elapsed}ms`);
    if (supportedVersions.length > 0) {
      console.log(
        `[NeoForge] Supported versions: ${supportedVersions.slice(0, 10).join(', ')}${
          supportedVersions.length > 10 ? '...' : ''
        }`
      );
    }
    return supportedVersions;
  } catch (e: unknown) {
    const elapsed = Date.now() - startTime;
    const errorMsg =
      e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : String(e);
    console.error(`[NeoForge] Failed to get supported versions after ${elapsed}ms:`, errorMsg || e);
    return [];
  }
}

