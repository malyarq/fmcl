export type RequestedVersionInfo = {
  requestedVersion: string;
  mcVersion: string;
  isNeoForge: boolean;
  isForge: boolean;
  isFabric: boolean;
};

/**
 * Parse launcher "version identifier" (e.g. "1.20.1-Forge") into runtime flags.
 * This logic is intentionally kept identical to the previous LauncherManager implementation.
 */
export function parseRequestedVersion(requestedVersionRaw: string): RequestedVersionInfo {
  const requestedVersion = requestedVersionRaw;
  const isNeoForge = requestedVersion.toLowerCase().includes('neoforge');
  const isForge = requestedVersion.toLowerCase().includes('forge') && !isNeoForge;
  const isFabric = requestedVersion.toLowerCase().includes('fabric');
  const mcVersion = isNeoForge
    ? requestedVersion.replace(/-?neoforge/i, '').trim()
    : isForge
      ? requestedVersion.replace(/-?forge/i, '').trim()
      : isFabric
        ? requestedVersion.replace(/-?fabric/i, '').trim()
        : requestedVersion.trim();

  return { requestedVersion, mcVersion, isNeoForge, isForge, isFabric };
}

export async function getFabricLoaderVersion(mcVersion: string, onLog: (data: string) => void): Promise<string | null> {
  try {
    const gameVersionsUrl = 'https://meta.fabricmc.net/v2/versions/game';
    const gameVersionsMirror = 'https://bmclapi2.bangbang93.com/fabric-meta/v2/versions/game';
    onLog('[Fabric] Checking game version support...');

    let gameVersions: Array<{ version: string }> = [];
    try {
      const response = await fetch(gameVersionsUrl);
      if (response.ok) {
        gameVersions = await response.json();
      }
    } catch {
      try {
        const response = await fetch(gameVersionsMirror);
        if (response.ok) {
          gameVersions = await response.json();
        }
      } catch (e: unknown) {
        const errorMsg = e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : String(e);
        throw new Error(`Failed to fetch Fabric game versions: ${errorMsg ?? e}`);
      }
    }

    const isSupported = gameVersions.some(v => v.version === mcVersion);
    if (!isSupported) {
      onLog(`[Fabric] Minecraft ${mcVersion} is not supported by Fabric`);
      return null;
    }

    const loaderVersionsUrl = 'https://meta.fabricmc.net/v2/versions/loader';
    const loaderVersionsMirror = 'https://bmclapi2.bangbang93.com/fabric-meta/v2/versions/loader';
    onLog('[Fabric] Fetching loader versions...');

    let loaderVersions: Array<{ version: string; stable: boolean }> = [];
    try {
      const response = await fetch(loaderVersionsUrl);
      if (response.ok) {
        loaderVersions = await response.json();
      }
    } catch {
      try {
        const response = await fetch(loaderVersionsMirror);
        if (response.ok) {
          loaderVersions = await response.json();
        }
      } catch (e: unknown) {
        const errorMsg = e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : String(e);
        throw new Error(`Failed to fetch Fabric loader versions: ${errorMsg ?? e}`);
      }
    }

    if (loaderVersions.length === 0) {
      onLog('[Fabric] No loader versions available');
      return null;
    }

    const stable = loaderVersions.find(v => v.stable);
    const latest = loaderVersions[0];
    const selected = stable ?? latest;
    onLog(`[Fabric] Selected loader version: ${selected.version}${selected.stable ? ' (stable)' : ''}`);
    return selected.version;
  } catch (e: unknown) {
    const errorMsg = e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : String(e);
    onLog(`[Fabric] Failed to get loader version: ${errorMsg ?? e}`);
    return null;
  }
}

export async function getNeoForgeVersion(mcVersion: string, onLog: (data: string) => void): Promise<string | null> {
  try {
    const bmclUrl = `https://bmclapi2.bangbang93.com/neoforge/list/${mcVersion}`;
    onLog('[NeoForge] Fetching version list from BMCLAPI...');
    const response = await fetch(bmclUrl);
    if (response.ok) {
      const data: Array<{ version: string }> = await response.json();
      if (data && data.length > 0) {
        const latest = data[0].version;
        onLog(`[NeoForge] Found version: ${latest}`);
        return latest;
      }
    }

    onLog('[NeoForge] Trying Maven API...');
    const mavenUrl = 'https://maven.neoforged.net/api/maven/versions/releases/net/neoforged/neoforge';
    const mavenResponse = await fetch(mavenUrl);
    if (mavenResponse.ok) {
      const mavenData = await mavenResponse.json();
      const versions: string[] = mavenData.versions || [];
      const mcParts = mcVersion.split('.');
      if (mcParts.length >= 2) {
        const major = mcParts[1];
        const minor = mcParts[2] || '0';
        const prefix = `${major}.${minor}.`;
        const matching = versions.filter(v => v.startsWith(prefix));
        if (matching.length > 0) {
          const latest = matching.sort().reverse()[0];
          onLog(`[NeoForge] Found version from Maven: ${latest}`);
          return latest;
        }
      }
    }

    onLog(`[NeoForge] No versions found for Minecraft ${mcVersion}`);
    return null;
  } catch (e: unknown) {
    const errorMsg = e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : String(e);
    onLog(`[NeoForge] Failed to fetch version: ${errorMsg ?? e}`);
    return null;
  }
}

export async function getOptiFineVersion(
  mcVersion: string,
  onLog: (data: string) => void
): Promise<{ type: string; patch: string } | null> {
  try {
    const versionListUrl = 'https://bmclapi2.bangbang93.com/optifine/versionList';
    onLog('[OptiFine] Fetching version list...');
    const response = await fetch(versionListUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const versions: Array<{ mcversion: string; type: string; patch: string }> = await response.json();
    const matchingVersions = versions.filter(v => v.mcversion === mcVersion);
    if (matchingVersions.length === 0) {
      onLog(`[OptiFine] No versions found for Minecraft ${mcVersion}`);
      return null;
    }
    const sorted = matchingVersions.sort((a, b) => {
      const aNum = parseInt(a.patch);
      const bNum = parseInt(b.patch);
      if (!isNaN(aNum) && !isNaN(bNum)) {
        return bNum - aNum;
      }
      return b.patch.localeCompare(a.patch);
    });
    const latest = sorted[0];
    onLog(`[OptiFine] Found version: ${latest.type}_${latest.patch}`);
    return { type: latest.type, patch: latest.patch };
  } catch (e: unknown) {
    const errorMsg = e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : String(e);
    onLog(`[OptiFine] Failed to fetch version list: ${errorMsg ?? e}`);
    return null;
  }
}

