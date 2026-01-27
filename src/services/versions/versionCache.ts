import type { MCVersion } from './types';

const DAY_MS = 24 * 60 * 60 * 1000;

const CACHE_KEYS = {
  versions: 'mc_versions',
  versionsTimestamp: 'mc_versions_timestamp',

  forgeVersions: 'forge_versions',
  fabricVersions: 'fabric_versions',
  optifineVersions: 'optifine_versions',
  neoforgeVersions: 'neoforge_versions',
  modVersionsTimestamp: 'mod_versions_timestamp',
} as const;

export type VersionCacheResult<T> = {
  value: T | null;
  isFresh: boolean;
};

const safeJsonParse = <T>(raw: string | null): T | null => {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

const readTimestamp = (key: string) => {
  const raw = localStorage.getItem(key) || '0';
  const n = parseInt(raw);
  return Number.isFinite(n) ? n : 0;
};

export function getCachedMinecraftVersions(now = Date.now()): VersionCacheResult<MCVersion[]> {
  const cached = safeJsonParse<MCVersion[]>(localStorage.getItem(CACHE_KEYS.versions));
  const ts = readTimestamp(CACHE_KEYS.versionsTimestamp);
  const isFresh = Boolean(cached) && now - ts < DAY_MS;
  return { value: cached, isFresh };
}

export function setCachedMinecraftVersions(versions: MCVersion[], now = Date.now()) {
  localStorage.setItem(CACHE_KEYS.versions, JSON.stringify(versions));
  localStorage.setItem(CACHE_KEYS.versionsTimestamp, now.toString());
}

export type ModSupportedVersionsCache = {
  forge: string[] | null;
  fabric: string[] | null;
  optifine: string[] | null;
  neoforge: string[] | null;
  isFresh: boolean;
};

export function getCachedModSupportedVersions(now = Date.now()): ModSupportedVersionsCache {
  const forge = safeJsonParse<string[]>(localStorage.getItem(CACHE_KEYS.forgeVersions));
  const fabric = safeJsonParse<string[]>(localStorage.getItem(CACHE_KEYS.fabricVersions));
  const optifine = safeJsonParse<string[]>(localStorage.getItem(CACHE_KEYS.optifineVersions));
  const neoforge = safeJsonParse<string[]>(localStorage.getItem(CACHE_KEYS.neoforgeVersions));

  const ts = readTimestamp(CACHE_KEYS.modVersionsTimestamp);
  const isFresh = now - ts < DAY_MS;
  return { forge, fabric, optifine, neoforge, isFresh };
}

export function setCachedForgeSupportedVersions(versions: string[]) {
  localStorage.setItem(CACHE_KEYS.forgeVersions, JSON.stringify(versions));
}

export function setCachedFabricSupportedVersions(versions: string[]) {
  localStorage.setItem(CACHE_KEYS.fabricVersions, JSON.stringify(versions));
}

export function setCachedOptiFineSupportedVersions(versions: string[]) {
  localStorage.setItem(CACHE_KEYS.optifineVersions, JSON.stringify(versions));
}

export function setCachedNeoForgeSupportedVersions(versions: string[]) {
  localStorage.setItem(CACHE_KEYS.neoforgeVersions, JSON.stringify(versions));
}

export function touchModSupportedVersionsTimestamp(now = Date.now()) {
  localStorage.setItem(CACHE_KEYS.modVersionsTimestamp, now.toString());
}

export function clearCachedModSupportedVersions() {
  localStorage.removeItem(CACHE_KEYS.forgeVersions);
  localStorage.removeItem(CACHE_KEYS.fabricVersions);
  localStorage.removeItem(CACHE_KEYS.optifineVersions);
  localStorage.removeItem(CACHE_KEYS.neoforgeVersions);
  localStorage.removeItem(CACHE_KEYS.modVersionsTimestamp);
}

