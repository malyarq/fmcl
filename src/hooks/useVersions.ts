import { useState, useEffect, useRef } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { MINECRAFT_VERSIONS } from '../utils/minecraftVersionsList';

const CACHE_KEY = 'mc_versions';
const CACHE_TIMESTAMP_KEY = 'mc_versions_timestamp';
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

const FORGE_VERSIONS_CACHE_KEY = 'forge_versions';
const FABRIC_VERSIONS_CACHE_KEY = 'fabric_versions';
const OPTIFINE_VERSIONS_CACHE_KEY = 'optifine_versions';
const NEOFORGE_VERSIONS_CACHE_KEY = 'neoforge_versions';
const MOD_VERSIONS_CACHE_TIMESTAMP_KEY = 'mod_versions_timestamp';

export interface MCVersion {
    id: string;
    type: string;
    url: string;
    time: string;
    releaseTime: string;
}

export function useVersions() {
    const [versions, setVersions] = useState<MCVersion[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { downloadProvider } = useSettings();

    // Fetch the official version manifest with a 24h local cache.
    useEffect(() => {
        const fetchVersions = async () => {
            // First, load from cache immediately (even if old) to show selector right away
            const cachedData = localStorage.getItem(CACHE_KEY);
            if (cachedData) {
                try {
                    const parsed = JSON.parse(cachedData);
                    setVersions(parsed);
                    setIsLoading(false); // Show UI immediately
                    console.log(`[Versions] Loaded ${parsed.length} versions from cache`);
                } catch {
                    console.warn('[Versions] Cache corrupted');
                }
            } else {
                // Use static fallback list from file
                setVersions(MINECRAFT_VERSIONS);
                setIsLoading(false); // Show UI immediately with fallback
                console.log(`[Versions] Using static fallback list (${MINECRAFT_VERSIONS.length} versions)`);
            }

            // Then check if we need to refresh in background
            const cacheTime = parseInt(localStorage.getItem(CACHE_TIMESTAMP_KEY) || '0');
            const now = Date.now();
            const isCacheValid = cachedData && (now - cacheTime < CACHE_DURATION_MS);

            if (isCacheValid) {
                console.log('[Versions] Cache is still valid, skipping refresh');
                return;
            }

            // Refresh in background
            console.log('[Versions] Cache expired or missing, refreshing in background...');
            try {
                if (!window.launcher?.getVersionList) {
                    throw new Error('Launcher API not available');
                }
                const data = await window.launcher.getVersionList(downloadProvider);

                const releases = data.versions.filter((v: MCVersion) => v.type === 'release');
                setVersions(releases); // Update with fresh data

                localStorage.setItem(CACHE_KEY, JSON.stringify(releases));
                localStorage.setItem(CACHE_TIMESTAMP_KEY, now.toString());
                console.log(`[Versions] Updated: ${releases.length} versions`);
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : String(err);
                console.error('[Versions] Failed to fetch versions:', err);
                setError(errorMessage);
                // Keep cached version or use static fallback
                if (!cachedData) {
                    setVersions(MINECRAFT_VERSIONS);
                    console.log(`[Versions] Using static fallback list due to error (${MINECRAFT_VERSIONS.length} versions)`);
                }
            }
        };

        fetchVersions();
    }, [downloadProvider]);

    return { versions, isLoading, error };
}

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
                const cachedForge = localStorage.getItem(FORGE_VERSIONS_CACHE_KEY);
                const cachedFabric = localStorage.getItem(FABRIC_VERSIONS_CACHE_KEY);
                const cachedOptiFine = localStorage.getItem(OPTIFINE_VERSIONS_CACHE_KEY);
                const cachedNeoForge = localStorage.getItem(NEOFORGE_VERSIONS_CACHE_KEY);
                
                if (cachedForge) {
                    try {
                        setForgeVersions(JSON.parse(cachedForge));
                        console.log(`[ModVersions] Loaded ${JSON.parse(cachedForge).length} Forge versions from cache`);
                    } catch {
                        console.warn('[ModVersions] Forge cache corrupted');
                    }
                }
                if (cachedFabric) {
                    try {
                        setFabricVersions(JSON.parse(cachedFabric));
                        console.log(`[ModVersions] Loaded ${JSON.parse(cachedFabric).length} Fabric versions from cache`);
                    } catch {
                        console.warn('[ModVersions] Fabric cache corrupted');
                    }
                }
                if (cachedOptiFine) {
                    try {
                        setOptiFineVersions(JSON.parse(cachedOptiFine));
                        console.log(`[ModVersions] Loaded ${JSON.parse(cachedOptiFine).length} OptiFine versions from cache`);
                    } catch {
                        console.warn('[ModVersions] OptiFine cache corrupted');
                    }
                }
                if (cachedNeoForge) {
                    try {
                        const cached = JSON.parse(cachedNeoForge);
                        setNeoForgeVersions(cached);
                        console.log(`[ModVersions] Loaded ${cached.length} NeoForge versions from cache`);
                    } catch {
                        console.warn('[ModVersions] NeoForge cache corrupted');
                    }
                } else {
                    // If no cache, show known supported versions immediately
                    // NeoForge supports 1.20.1+ versions
                    const knownVersions = [
                        '1.20.1', '1.20.2', '1.20.3', '1.20.4', '1.20.5', '1.20.6',
                        '1.21', '1.21.1', '1.21.2', '1.21.3', '1.21.4', '1.21.5',
                        '1.21.6', '1.21.7', '1.21.8', '1.21.9', '1.21.10', '1.21.11'
                    ];
                    setNeoForgeVersions(knownVersions);
                    console.log(`[ModVersions] Using initial NeoForge versions list (${knownVersions.length} versions)`);
                }
                
                // Mark as loaded immediately so buttons show up
                setIsLoading(false);
            } catch {
                console.warn('[ModVersions] Failed to load from cache');
                setIsLoading(false);
            }

            // Then, check if we need to refresh and update in background
            const cacheTime = parseInt(localStorage.getItem(MOD_VERSIONS_CACHE_TIMESTAMP_KEY) || '0');
            const now = Date.now();
            const isCacheValid = now - cacheTime < CACHE_DURATION_MS;
            
            // If NeoForge cache is missing or empty, force refresh
            const hasNeoForgeCache = localStorage.getItem(NEOFORGE_VERSIONS_CACHE_KEY);
            let shouldForceRefresh = false;
            if (!hasNeoForgeCache) {
                shouldForceRefresh = true;
                console.log('[ModVersions] NeoForge cache missing, forcing refresh...');
            } else {
                try {
                    const cachedVersions = JSON.parse(hasNeoForgeCache);
                    if (!Array.isArray(cachedVersions) || cachedVersions.length === 0) {
                        shouldForceRefresh = true;
                        console.log('[ModVersions] NeoForge cache is empty, forcing refresh...');
                    }
                } catch {
                    shouldForceRefresh = true;
                    console.log('[ModVersions] NeoForge cache corrupted, forcing refresh...');
                }
            }

            if (isCacheValid && !shouldForceRefresh) {
                console.log('[ModVersions] Cache is still valid, skipping refresh');
                return;
            }

            // Refresh in background
            console.log('[ModVersions] Cache expired or missing, refreshing in background...');
            
            if (!window.launcher) {
                console.error('[ModVersions] Launcher API not available');
                return;
            }

            try {
                // Fetch all mod versions in parallel
                console.log('[ModVersions] Fetching Forge, Fabric, OptiFine, and NeoForge supported versions...');
                const startTime = Date.now();
                
                const [forge, fabric, optiFine, neoForge] = await Promise.allSettled([
                    window.launcher.getForgeSupportedVersions(downloadProvider),
                    window.launcher.getFabricSupportedVersions(),
                    window.launcher.getOptiFineSupportedVersions(),
                    window.launcher.getNeoForgeSupportedVersions(downloadProvider)
                ]);

                const elapsed = Date.now() - startTime;
                console.log(`[ModVersions] Fetch completed in ${elapsed}ms`);

                if (forge.status === 'fulfilled') {
                    setForgeVersions(forge.value);
                    localStorage.setItem(FORGE_VERSIONS_CACHE_KEY, JSON.stringify(forge.value));
                    console.log(`[ModVersions] Updated Forge versions: ${forge.value.length} versions`);
                } else {
                    console.error('[ModVersions] Failed to fetch Forge versions:', forge.reason);
                }
                
                if (fabric.status === 'fulfilled') {
                    setFabricVersions(fabric.value);
                    localStorage.setItem(FABRIC_VERSIONS_CACHE_KEY, JSON.stringify(fabric.value));
                    console.log(`[ModVersions] Updated Fabric versions: ${fabric.value.length} versions`);
                } else {
                    console.error('[ModVersions] Failed to fetch Fabric versions:', fabric.reason);
                }
                
                if (optiFine.status === 'fulfilled') {
                    setOptiFineVersions(optiFine.value);
                    localStorage.setItem(OPTIFINE_VERSIONS_CACHE_KEY, JSON.stringify(optiFine.value));
                    console.log(`[ModVersions] Updated OptiFine versions: ${optiFine.value.length} versions`);
                } else {
                    console.error('[ModVersions] Failed to fetch OptiFine versions:', optiFine.reason);
                }

                if (neoForge.status === 'fulfilled') {
                    const versions = neoForge.value || [];
                    setNeoForgeVersions(versions);
                    localStorage.setItem(NEOFORGE_VERSIONS_CACHE_KEY, JSON.stringify(versions));
                    console.log(`[ModVersions] Updated NeoForge versions: ${versions.length} versions`);
                    if (versions.length > 0) {
                        console.log(`[ModVersions] NeoForge supported versions: ${versions.slice(0, 10).join(', ')}${versions.length > 10 ? '...' : ''}`);
                    } else {
                        console.warn('[ModVersions] NeoForge versions list is empty!');
                    }
                } else {
                    console.error('[ModVersions] Failed to fetch NeoForge versions:', neoForge.reason);
                    // If fetch failed, try to keep cached version if available
                    const cached = localStorage.getItem(NEOFORGE_VERSIONS_CACHE_KEY);
                    if (cached) {
                        try {
                            const cachedVersions = JSON.parse(cached);
                            if (cachedVersions.length > 0) {
                                console.log('[ModVersions] Keeping cached NeoForge versions due to fetch failure');
                                setNeoForgeVersions(cachedVersions);
                            }
                        } catch {
                            console.warn('[ModVersions] Failed to parse cached NeoForge versions');
                        }
                    }
                }

                localStorage.setItem(MOD_VERSIONS_CACHE_TIMESTAMP_KEY, now.toString());
                console.log('[ModVersions] Cache updated successfully');
            } catch (err) {
                console.error('[ModVersions] Failed to refresh mod versions:', err);
            } finally {
                fetchingRef.current = false;
            }
        };

        fetchModVersions();
        
        return () => {
            fetchingRef.current = false;
        };
    }, [downloadProvider]);

    return { forgeVersions, fabricVersions, optiFineVersions, neoForgeVersions, isLoading };
}
