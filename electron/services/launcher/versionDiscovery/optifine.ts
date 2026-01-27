import type { VersionEntry } from '../types';

export async function discoverOptiFineSupportedVersions(params: {
  getVersionList: () => Promise<{ versions: VersionEntry[] }>;
}): Promise<string[]> {
  const { getVersionList } = params;

  console.log('[OptiFine] Starting to fetch supported versions...');
  const startTime = Date.now();
  try {
    console.log('[OptiFine] Fetching OptiFine version list from BMCLAPI...');
    const versionListUrl = 'https://bmclapi2.bangbang93.com/optifine/versionList';
    const response = await fetch(versionListUrl);
    if (!response.ok) {
      console.error(`[OptiFine] Failed to fetch version list: HTTP ${response.status}`);
      return [];
    }
    const optiFineVersions: Array<{ mcversion: string; type: string; patch: string }> = await response.json();
    console.log(`[OptiFine] Got ${optiFineVersions.length} OptiFine versions from API`);

    const supportedSet = new Set(optiFineVersions.map((v: { mcversion: string; type: string; patch: string }) => v.mcversion));
    console.log(`[OptiFine] Unique Minecraft versions in OptiFine list: ${supportedSet.size}`);

    console.log('[OptiFine] Fetching Minecraft version list...');
    const versionList = await getVersionList();
    const releaseVersions = (versionList.versions as VersionEntry[]).filter((v: VersionEntry) => v.type === 'release');
    console.log(`[OptiFine] Found ${releaseVersions.length} release versions to match`);

    const supported = versionList.versions
      .filter((v: VersionEntry) => v.type === 'release' && supportedSet.has(v.id))
      .map((v: VersionEntry) => v.id);

    const elapsed = Date.now() - startTime;
    console.log(`[OptiFine] Completed: found ${supported.length} supported versions in ${elapsed}ms`);
    return supported;
  } catch (e: unknown) {
    const elapsed = Date.now() - startTime;
    const errorMsg =
      e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : String(e);
    console.error(`[OptiFine] Failed to get supported versions after ${elapsed}ms:`, errorMsg || e);
    return [];
  }
}

