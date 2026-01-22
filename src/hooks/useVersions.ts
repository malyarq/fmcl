import { useState, useEffect } from 'react';

const MANIFEST_URL = 'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json';
const CACHE_KEY = 'mc_versions';
const CACHE_TIMESTAMP_KEY = 'mc_versions_timestamp';
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

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

    useEffect(() => {
        const fetchVersions = async () => {
            setIsLoading(true);
            try {
                // Check Cache
                const cachedData = localStorage.getItem(CACHE_KEY);
                const cacheTime = parseInt(localStorage.getItem(CACHE_TIMESTAMP_KEY) || '0');
                const now = Date.now();

                const isCacheValid = cachedData && (now - cacheTime < CACHE_DURATION_MS);

                if (isCacheValid) {
                    try {
                        const parsed = JSON.parse(cachedData!);
                        setVersions(parsed);
                        setIsLoading(false);
                        return; // Cache hit
                    } catch (e) {
                        console.warn('Cache corrupted, refetching...');
                    }
                }

                // Network Fetch
                const res = await fetch(MANIFEST_URL);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();

                const releases = data.versions.filter((v: any) => v.type === 'release');
                setVersions(releases);

                // Update Cache
                localStorage.setItem(CACHE_KEY, JSON.stringify(releases));
                localStorage.setItem(CACHE_TIMESTAMP_KEY, now.toString());
            } catch (err: any) {
                console.error('Failed to fetch versions:', err);
                setError(err.message);

                // Fallback to cache if network failed even if expired
                const cachedData = localStorage.getItem(CACHE_KEY);
                if (cachedData) {
                    try {
                        setVersions(JSON.parse(cachedData));
                    } catch (_) { }
                } else {
                    // Critical Fallback
                    setVersions([{ id: '1.20.4', type: 'release', url: '', time: '', releaseTime: '' }, { id: '1.16.5', type: 'release', url: '', time: '', releaseTime: '' }, { id: '1.12.2', type: 'release', url: '', time: '', releaseTime: '' }, { id: '1.7.10', type: 'release', url: '', time: '', releaseTime: '' }]);
                }
            } finally {
                setIsLoading(false);
            }
        };

        fetchVersions();
    }, []);

    return { versions, isLoading, error };
}
