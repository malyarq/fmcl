import { toIpcError } from './ipcError';

type CacheApi = Window['cache'];
type NamespacedCacheApi = Window['api']['cache'];

function getCacheApi(): NamespacedCacheApi | CacheApi | undefined {
  if (typeof window === 'undefined') return undefined;
  if (window.api?.cache) return window.api.cache;
  if (window.cache) return window.cache;
  return undefined;
}

function hasCache(): boolean {
  return Boolean(getCacheApi());
}

function hasMethod<K extends keyof CacheApi>(key: K): boolean {
  const api = getCacheApi() as CacheApi | undefined;
  return Boolean(api && typeof api[key] === 'function');
}

function requireCache(methodName: string): CacheApi {
  const api = getCacheApi() as CacheApi | undefined;
  if (!api) {
    throw new Error(`[cacheIPC] cache API is not available (method: ${methodName})`);
  }
  return api;
}

async function call<T>(methodName: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    const e = toIpcError({ namespace: 'cacheIPC', method: methodName }, err);
    console.error(e);
    throw e;
  }
}

export const cacheIPC = {
  isAvailable(): boolean {
    return hasCache();
  },

  has<K extends keyof CacheApi>(key: K): boolean {
    return hasMethod(key);
  },

  clear(): ReturnType<CacheApi['clear']> {
    return call('clear', () => requireCache('clear').clear());
  },
  reload(): ReturnType<CacheApi['reload']> {
    return call('reload', () => requireCache('reload').reload());
  },
};

export type CacheIPC = typeof cacheIPC;
