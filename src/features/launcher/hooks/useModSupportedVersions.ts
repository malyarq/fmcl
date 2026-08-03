import { useEffect, useState } from 'react';
import {
  getCachedModSupportedVersions,
  setCachedFabricSupportedVersions,
  setCachedForgeSupportedVersions,
  setCachedNeoForgeSupportedVersions,
  setCachedOptiFineSupportedVersions,
  touchModSupportedVersionsTimestamp,
} from '../../../services/versions/versionCache';
import {
  fetchFabricSupportedVersions,
  fetchForgeSupportedVersions,
  fetchNeoForgeSupportedVersions,
  fetchOptiFineSupportedVersions,
} from '../../../services/versions/versionApi';

type RefreshedModVersions = {
  forge?: string[];
  fabric?: string[];
  optifine?: string[];
  neoforge?: string[];
};

let inFlightRefresh: Promise<RefreshedModVersions> | null = null;

function refreshModSupportedVersions(): Promise<RefreshedModVersions> {
  if (inFlightRefresh) {
    console.log('[ModVersions] Joining the in-flight refresh');
    return inFlightRefresh;
  }

  inFlightRefresh = (async () => {
    console.log('[ModVersions] Fetching Forge, Fabric, OptiFine, and NeoForge supported versions...');
    const startTime = Date.now();
    const [forge, fabric, optiFine, neoForge] = await Promise.allSettled([
      fetchForgeSupportedVersions(),
      fetchFabricSupportedVersions(),
      fetchOptiFineSupportedVersions(),
      fetchNeoForgeSupportedVersions(),
    ]);
    const refreshed: RefreshedModVersions = {};

    console.log(`[ModVersions] Fetch completed in ${Date.now() - startTime}ms`);
    if (forge.status === 'fulfilled') {
      refreshed.forge = forge.value ?? [];
      setCachedForgeSupportedVersions(refreshed.forge);
      console.log(`[ModVersions] Updated Forge versions: ${refreshed.forge.length} versions`);
    } else {
      console.error('[ModVersions] Failed to fetch Forge versions:', forge.reason);
    }

    if (fabric.status === 'fulfilled') {
      refreshed.fabric = fabric.value ?? [];
      setCachedFabricSupportedVersions(refreshed.fabric);
      console.log(`[ModVersions] Updated Fabric versions: ${refreshed.fabric.length} versions`);
    } else {
      console.error('[ModVersions] Failed to fetch Fabric versions:', fabric.reason);
    }

    if (optiFine.status === 'fulfilled') {
      refreshed.optifine = optiFine.value ?? [];
      setCachedOptiFineSupportedVersions(refreshed.optifine);
      console.log(`[ModVersions] Updated OptiFine versions: ${refreshed.optifine.length} versions`);
    } else {
      console.error('[ModVersions] Failed to fetch OptiFine versions:', optiFine.reason);
    }

    if (neoForge.status === 'fulfilled') {
      refreshed.neoforge = neoForge.value ?? [];
      setCachedNeoForgeSupportedVersions(refreshed.neoforge);
      console.log(`[ModVersions] Updated NeoForge versions: ${refreshed.neoforge.length} versions`);
      if (refreshed.neoforge.length > 0) {
        console.log(
          `[ModVersions] NeoForge supported versions: ${refreshed.neoforge.slice(0, 10).join(', ')}${
            refreshed.neoforge.length > 10 ? '...' : ''
          }`
        );
      } else {
        console.warn('[ModVersions] NeoForge versions list is empty!');
      }
    } else {
      console.error('[ModVersions] Failed to fetch NeoForge versions:', neoForge.reason);
    }

    if (Object.keys(refreshed).length > 0) {
      touchModSupportedVersionsTimestamp();
      console.log('[ModVersions] Cache updated successfully');
    }
    return refreshed;
  })().finally(() => {
    inFlightRefresh = null;
  });

  return inFlightRefresh;
}

export function useModSupportedVersions() {
  const [forgeVersions, setForgeVersions] = useState<string[]>([]);
  const [fabricVersions, setFabricVersions] = useState<string[]>([]);
  const [optiFineVersions, setOptiFineVersions] = useState<string[]>([]);
  const [neoForgeVersions, setNeoForgeVersions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const fetchModVersions = async () => {
      // First, load from cache immediately (even if old) to show buttons right away
      try {
        const cached = getCachedModSupportedVersions();

        if (cached.forge) {
          setForgeVersions(cached.forge);
          console.log(`[ModVersions] Loaded ${cached.forge.length} Forge versions from cache`);
        }
        if (cached.fabric) {
          setFabricVersions(cached.fabric);
          console.log(`[ModVersions] Loaded ${cached.fabric.length} Fabric versions from cache`);
        }
        if (cached.optifine) {
          setOptiFineVersions(cached.optifine);
          console.log(`[ModVersions] Loaded ${cached.optifine.length} OptiFine versions from cache`);
        }
        if (cached.neoforge) {
          setNeoForgeVersions(cached.neoforge);
          console.log(`[ModVersions] Loaded ${cached.neoforge.length} NeoForge versions from cache`);
        } else {
          // NeoForge supports 1.20.1+ versions - use known versions as fallback
          const knownVersions = [
            '1.20.1',
            '1.20.2',
            '1.20.3',
            '1.20.4',
            '1.20.5',
            '1.20.6',
            '1.21',
            '1.21.1',
            '1.21.2',
            '1.21.3',
            '1.21.4',
            '1.21.5',
            '1.21.6',
            '1.21.7',
            '1.21.8',
            '1.21.9',
            '1.21.10',
            '1.21.11',
          ];
          setNeoForgeVersions(knownVersions);
          console.log(`[ModVersions] Using initial NeoForge versions list (${knownVersions.length} versions)`);
        }

        setIsLoading(false);
      } catch {
        console.warn('[ModVersions] Failed to load from cache');
        setIsLoading(false);
      }

      // Then, check if we need to refresh and update in background
      const cached = getCachedModSupportedVersions();
      const shouldForceRefresh = !cached.neoforge || cached.neoforge.length === 0;
      if (!cached.neoforge) console.log('[ModVersions] NeoForge cache missing, forcing refresh...');
      else if (cached.neoforge.length === 0) console.log('[ModVersions] NeoForge cache is empty, forcing refresh...');

      if (cached.isFresh && !shouldForceRefresh) {
        console.log('[ModVersions] Cache is still valid, skipping refresh');
        return;
      }

      console.log('[ModVersions] Cache expired or missing, refreshing in background...');

      try {
        const refreshed = await refreshModSupportedVersions();
        if (!active) return;
        if (refreshed.forge) setForgeVersions(refreshed.forge);
        if (refreshed.fabric) setFabricVersions(refreshed.fabric);
        if (refreshed.optifine) setOptiFineVersions(refreshed.optifine);
        if (refreshed.neoforge) setNeoForgeVersions(refreshed.neoforge);
      } catch (err) {
        console.error('[ModVersions] Failed to refresh mod versions:', err);
      }
    };

    void fetchModVersions();

    return () => {
      active = false;
    };
  }, []);

  return { forgeVersions, fabricVersions, optiFineVersions, neoForgeVersions, isLoading };
}
