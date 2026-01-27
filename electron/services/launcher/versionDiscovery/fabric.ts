import type { VersionEntry } from '../types';

export async function discoverFabricSupportedVersions(params: {
  getVersionList: () => Promise<{ versions: VersionEntry[] }>;
}): Promise<string[]> {
  const { getVersionList } = params;

  console.log('[Fabric] Starting to fetch supported versions...');
  const startTime = Date.now();
  try {
    console.log('[Fabric] Fetching Minecraft version list...');
    const versionList = await getVersionList();
    const releaseVersions = (versionList.versions as VersionEntry[]).filter((v: VersionEntry) => v.type === 'release');
    console.log(`[Fabric] Found ${releaseVersions.length} release versions to check`);

    const gameVersionsUrl = 'https://meta.fabricmc.net/v2/versions/game';
    const gameVersionsMirror = 'https://bmclapi2.bangbang93.com/fabric-meta/v2/versions/game';

    console.log('[Fabric] Fetching Fabric game versions from official API...');
    let gameVersions: Array<{ version: string }> = [];
    try {
      const response = await fetch(gameVersionsUrl);
      if (response.ok) {
        gameVersions = await response.json();
        console.log(`[Fabric] Got ${gameVersions.length} game versions from official API`);
      } else {
        console.warn(`[Fabric] Official API returned status ${response.status}, trying mirror...`);
        throw new Error(`HTTP ${response.status}`);
      }
    } catch {
      console.log('[Fabric] Official API failed, trying mirror...');
      try {
        const response = await fetch(gameVersionsMirror);
        if (response.ok) {
          gameVersions = await response.json();
          console.log(`[Fabric] Got ${gameVersions.length} game versions from mirror`);
        } else {
          console.error(`[Fabric] Mirror also failed with status ${response.status}`);
          return [];
        }
      } catch (e2: unknown) {
        const errorMsg = e2 instanceof Error ? e2.message : String(e2);
        console.error('[Fabric] Both official and mirror failed:', errorMsg);
        return [];
      }
    }

    const supportedSet = new Set(gameVersions.map((v: { version: string }) => v.version));
    const supported = versionList.versions
      .filter((v: VersionEntry) => v.type === 'release' && supportedSet.has(v.id))
      .map((v: VersionEntry) => v.id);

    const elapsed = Date.now() - startTime;
    console.log(`[Fabric] Completed: found ${supported.length} supported versions in ${elapsed}ms`);
    return supported;
  } catch (e: unknown) {
    const elapsed = Date.now() - startTime;
    const errorMsg = e instanceof Error ? e.message : String(e);
    console.error(`[Fabric] Failed to get supported versions after ${elapsed}ms:`, errorMsg);
    return [];
  }
}

