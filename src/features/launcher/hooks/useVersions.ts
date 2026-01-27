import { useEffect, useState } from 'react';
import { useSettings } from '../../../contexts/SettingsContext';
import { MINECRAFT_VERSIONS } from '../../../utils/minecraftVersionsList';
import type { MCVersion } from '../../../services/versions/types';
import {
  getCachedMinecraftVersions,
  setCachedMinecraftVersions,
} from '../../../services/versions/versionCache';
import {
  fetchMinecraftVersionList,
  filterReleaseVersions,
} from '../../../services/versions/versionApi';

export function useVersions() {
  const [versions, setVersions] = useState<MCVersion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { downloadProvider } = useSettings();

  // Fetch the official version manifest with a 24h local cache.
  useEffect(() => {
    const fetchVersions = async () => {
      // First, load from cache immediately (even if old) to show selector right away
      const { value: cached, isFresh } = getCachedMinecraftVersions();
      if (cached) {
        setVersions(cached);
        setIsLoading(false);
        console.log(`[Versions] Loaded ${cached.length} versions from cache`);
      } else {
        setVersions(MINECRAFT_VERSIONS);
        setIsLoading(false);
        console.log(`[Versions] Using static fallback list (${MINECRAFT_VERSIONS.length} versions)`);
      }

      // Then check if we need to refresh in background
      if (isFresh) {
        console.log('[Versions] Cache is still valid, skipping refresh');
        return;
      }

      console.log('[Versions] Cache expired or missing, refreshing in background...');
      try {
        const data = await fetchMinecraftVersionList(downloadProvider);
        if (!data) return;

        const releases = filterReleaseVersions(data);
        setVersions(releases);

        setCachedMinecraftVersions(releases);
        console.log(`[Versions] Updated: ${releases.length} versions`);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.warn('[Versions] Failed to fetch versions:', err);
        setError(errorMessage);
        // Keep cached version or use static fallback
        if (!cached) {
          setVersions(MINECRAFT_VERSIONS);
          console.log(`[Versions] Using static fallback list due to error (${MINECRAFT_VERSIONS.length} versions)`);
        }
      }
    };

    fetchVersions();
  }, [downloadProvider]);

  return { versions, isLoading, error };
}

