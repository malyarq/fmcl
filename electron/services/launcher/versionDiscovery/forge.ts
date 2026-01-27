import { getForgeVersionList } from '@xmcl/installer';
import type { DownloadProviderId } from '../../mirrors/providers';
import type { VersionEntry } from '../types';

function isForgeInstallerSupportedMcVersion(versionId: string): boolean {
  // This app installs Forge via XMCL `installForgeTask`, which relies on modern Forge installer flows.
  // Very old MC versions (e.g. 1.1, 1.2.5) either don't have installer artifacts or use legacy formats.
  // Keep vanilla launch support, but don't advertise Forge for those versions.
  const m = versionId.match(/^(\d+)\.(\d+)(?:\.(\d+))?$/);
  if (!m) return false;
  const major = Number(m[1]);
  const minor = Number(m[2]);
  if (!Number.isFinite(major) || !Number.isFinite(minor)) return false;
  return major > 1 || (major === 1 && minor >= 6);
}

export async function discoverForgeSupportedVersions(params: {
  getVersionList: (providerId?: DownloadProviderId) => Promise<{ versions: VersionEntry[] }>;
  providerId?: DownloadProviderId;
}): Promise<string[]> {
  const { getVersionList, providerId } = params;

  console.log('[Forge] Starting to fetch supported versions...');
  const startTime = Date.now();
  try {
    console.log('[Forge] Fetching Minecraft version list...');
    const versionList = await getVersionList(providerId);
    const releaseVersions = (versionList.versions as VersionEntry[])
      .filter((v: VersionEntry) => v.type === 'release')
      .filter((v: VersionEntry) => isForgeInstallerSupportedMcVersion(v.id));
    console.log(`[Forge] Found ${releaseVersions.length} release versions to check`);

    const supportedVersions: string[] = [];

    // First, try to get all supported versions from promotions JSON (much faster)
    try {
      console.log('[Forge] Trying promotions JSON method (fast)...');
      const promotionsUrl = 'https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json';
      const response = await fetch(promotionsUrl);
      if (response.ok) {
        const data = await response.json();
        const promos = data.promos || {};

        for (const version of releaseVersions) {
          const promoKey = `${version.id}-recommended`;
          const latestKey = `${version.id}-latest`;
          if (promos[promoKey] || promos[latestKey]) {
            supportedVersions.push(version.id);
          }
        }

        // If we got results from promotions, return them
        if (supportedVersions.length > 0) {
          const elapsed = Date.now() - startTime;
          console.log(`[Forge] Found ${supportedVersions.length} supported versions via promotions in ${elapsed}ms`);
          return supportedVersions;
        }
        console.log('[Forge] Promotions method returned 0 versions, falling back to individual checks');
      } else {
        console.warn(`[Forge] Promotions fetch failed with status ${response.status}`);
      }
    } catch (e: unknown) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      console.warn('[Forge] Promotions check failed, falling back to individual checks:', errorMsg);
    }

    console.log('[Forge] Starting individual version checks (this may take a while)...');
    let checked = 0;
    for (const version of versionList.versions) {
      if (version.type !== 'release') continue;
      if (!isForgeInstallerSupportedMcVersion(version.id)) continue;
      checked++;
      if (checked % 10 === 0) {
        console.log(
          `[Forge] Checked ${checked}/${releaseVersions.length} versions, found ${supportedVersions.length} so far...`
        );
      }
      try {
        const forgeList = await getForgeVersionList({ minecraft: version.id });
        const pages = Array.isArray(forgeList) ? forgeList : [forgeList];
        const page = pages.find((p) => p.mcversion === version.id);
        if (page && page.versions.length > 0) {
          supportedVersions.push(version.id);
        }
      } catch {
        // Skip versions that fail to check
      }
    }
    const elapsed = Date.now() - startTime;
    console.log(`[Forge] Completed: found ${supportedVersions.length} supported versions in ${elapsed}ms`);
    return supportedVersions;
  } catch (e: unknown) {
    const elapsed = Date.now() - startTime;
    const errorMsg = e instanceof Error ? e.message : String(e);
    console.error(`[Forge] Failed to get supported versions after ${elapsed}ms:`, errorMsg);
    return [];
  }
}

