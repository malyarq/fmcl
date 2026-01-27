import { useEffect, useRef, useState } from 'react';
import { useSettings } from '../../../contexts/SettingsContext';
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

export function useModSupportedVersions() {
  const [forgeVersions, setForgeVersions] = useState<string[]>([]);
  const [fabricVersions, setFabricVersions] = useState<string[]>([]);
  const [optiFineVersions, setOptiFineVersions] = useState<string[]>([]);
  const [neoForgeVersions, setNeoForgeVersions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { downloadProvider } = useSettings();
  const fetchingRef = useRef(false);

  useEffect(() => {
    const fetchModVersions = async () => {
      // Prevent duplicate calls in React StrictMode
      if (fetchingRef.current) {
        console.log('[ModVersions] Already fetching, skipping duplicate call');
        return;
      }
      fetchingRef.current = true;
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
        // Fetch all mod versions in parallel
        console.log('[ModVersions] Fetching Forge, Fabric, OptiFine, and NeoForge supported versions...');
        const startTime = Date.now();

        const [forge, fabric, optiFine, neoForge] = await Promise.allSettled([
          fetchForgeSupportedVersions(downloadProvider),
          fetchFabricSupportedVersions(),
          fetchOptiFineSupportedVersions(),
          fetchNeoForgeSupportedVersions(downloadProvider),
        ]);

        const elapsed = Date.now() - startTime;
        console.log(`[ModVersions] Fetch completed in ${elapsed}ms`);

        if (forge.status === 'fulfilled') {
          const value = forge.value ?? [];
          setForgeVersions(value);
          setCachedForgeSupportedVersions(value);
          console.log(`[ModVersions] Updated Forge versions: ${value.length} versions`);
        } else {
          console.error('[ModVersions] Failed to fetch Forge versions:', forge.reason);
        }

        if (fabric.status === 'fulfilled') {
          const value = fabric.value ?? [];
          setFabricVersions(value);
          setCachedFabricSupportedVersions(value);
          console.log(`[ModVersions] Updated Fabric versions: ${value.length} versions`);
        } else {
          console.error('[ModVersions] Failed to fetch Fabric versions:', fabric.reason);
        }

        if (optiFine.status === 'fulfilled') {
          const value = optiFine.value ?? [];
          setOptiFineVersions(value);
          setCachedOptiFineSupportedVersions(value);
          console.log(`[ModVersions] Updated OptiFine versions: ${value.length} versions`);
        } else {
          console.error('[ModVersions] Failed to fetch OptiFine versions:', optiFine.reason);
        }

        if (neoForge.status === 'fulfilled') {
          const versions = neoForge.value || [];
          setNeoForgeVersions(versions);
          setCachedNeoForgeSupportedVersions(versions);
          console.log(`[ModVersions] Updated NeoForge versions: ${versions.length} versions`);
          if (versions.length > 0) {
            console.log(
              `[ModVersions] NeoForge supported versions: ${versions.slice(0, 10).join(', ')}${
                versions.length > 10 ? '...' : ''
              }`
            );
          } else {
            console.warn('[ModVersions] NeoForge versions list is empty!');
          }
        } else {
          console.error('[ModVersions] Failed to fetch NeoForge versions:', neoForge.reason);
          // Keep cache as-is on failure.
        }

        touchModSupportedVersionsTimestamp();
        console.log('[ModVersions] Cache updated successfully');
      } catch (err) {
        console.error('[ModVersions] Failed to refresh mod versions:', err);
      } finally {
        fetchingRef.current = false;
      }
    };

    void fetchModVersions();

    return () => {
      fetchingRef.current = false;
    };
  }, [downloadProvider]);

  return { forgeVersions, fabricVersions, optiFineVersions, neoForgeVersions, isLoading };
}

