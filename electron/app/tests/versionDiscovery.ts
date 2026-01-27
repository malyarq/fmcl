import type { DownloadProviderId } from '../../services/mirrors/providers';
import type { VersionListService } from '../../services/versions/versionListService';
import type { VersionEntry } from '../../services/launcher/types';
import { getForgeSupportedVersions, getFabricSupportedVersions, getNeoForgeSupportedVersions } from '../../services/launcher/versionResolver';

export type DiscoveredVersions = {
  allReleaseVersions: string[];
  forgeVersions: string[];
  neoforgeVersions: string[];
  fabricVersions: string[];
};

export async function discoverVersions(params: {
  versionLists: VersionListService;
  providerId: DownloadProviderId;
  enabledStages: Set<string>;
  onLog: (line: string) => void;
}): Promise<DiscoveredVersions> {
  const { versionLists, providerId, enabledStages, onLog } = params;

  // Get all release versions from Minecraft version manifest
  // Always needed for vanilla stage or to determine which versions to install
  let allReleaseVersions: string[] = [];
  try {
    onLog(`[FullTest] Fetching all Minecraft release versions...`);
    const versionList = await versionLists.getVersionList(providerId);
    allReleaseVersions = (versionList.versions as Array<{ id: string; type: string }>)
      .filter((v) => v.type === 'release')
      .map((v) => v.id)
      .sort();
    onLog(`[FullTest] Found ${allReleaseVersions.length} total release versions`);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    onLog(`[FullTest] Failed to fetch version list: ${msg}`);
    throw e;
  }

  // Only discover modloader versions that are actually needed
  let forgeVersions: string[] = [];
  if (enabledStages.has('forge')) {
    try {
      onLog(`[FullTest] Discovering Forge-supported versions...`);
      forgeVersions = await getForgeSupportedVersions({
        getVersionList: async (id?: DownloadProviderId) => {
          const list = await versionLists.getVersionList(id);
          return { versions: list.versions as VersionEntry[] };
        },
        providerId,
      });
      onLog(`[FullTest] Found ${forgeVersions.length} Forge-supported versions`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      onLog(`[FullTest] Failed to discover Forge versions: ${msg}`);
    }
  }

  let neoforgeVersions: string[] = [];
  if (enabledStages.has('neoforge')) {
    // NeoForge discovery works best with BMCL provider, so use it explicitly
    const neoforgeProviderId: DownloadProviderId = providerId === 'mojang' ? 'bmcl' : providerId === 'auto' ? 'bmcl' : providerId;
    try {
      onLog(`[FullTest] Discovering NeoForge-supported versions (using ${neoforgeProviderId} provider)...`);
      neoforgeVersions = await getNeoForgeSupportedVersions({
        getVersionList: async (id?: DownloadProviderId) => {
          const list = await versionLists.getVersionList(id || neoforgeProviderId);
          return { versions: list.versions as VersionEntry[] };
        },
        providerId: neoforgeProviderId,
      });
      onLog(`[FullTest] Found ${neoforgeVersions.length} NeoForge-supported versions`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      onLog(`[FullTest] Failed to discover NeoForge versions: ${msg}`);
      // NeoForge discovery should work with BMCL, so if it failed, something is wrong
      onLog(`[FullTest] NeoForge discovery failed - this may indicate a network issue`);
    }
  }

  let fabricVersions: string[] = [];
  if (enabledStages.has('fabric')) {
    try {
      onLog(`[FullTest] Discovering Fabric-supported versions...`);
      fabricVersions = await getFabricSupportedVersions({
        getVersionList: async () => {
          const list = await versionLists.getVersionList();
          return { versions: list.versions as VersionEntry[] };
        },
      });
      onLog(`[FullTest] Found ${fabricVersions.length} Fabric-supported versions`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      onLog(`[FullTest] Failed to discover Fabric versions: ${msg}`);
    }
  }

  return {
    allReleaseVersions,
    forgeVersions,
    neoforgeVersions,
    fabricVersions,
  };
}
