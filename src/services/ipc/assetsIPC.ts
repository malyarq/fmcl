import { toIpcError } from './ipcError';

type AssetsApi = Window['assets'];
type NamespacedAssetsApi = Window['api']['assets'];

function getAssetsApi(): NamespacedAssetsApi | AssetsApi | undefined {
  if (typeof window === 'undefined') return undefined;
  if (window.api?.assets) return window.api.assets;
  if (window.assets) return window.assets;
  return undefined;
}

function hasAssets(): boolean {
  return Boolean(getAssetsApi());
}

function hasMethod<K extends keyof AssetsApi>(key: K): boolean {
  const api = getAssetsApi() as AssetsApi | undefined;
  return Boolean(api && typeof api[key] === 'function');
}

function requireAssets(methodName: string): AssetsApi {
  const api = getAssetsApi() as AssetsApi | undefined;
  if (!api) {
    throw new Error(`[assetsIPC] assets API is not available (method: ${methodName})`);
  }
  return api;
}

async function call<T>(methodName: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    const e = toIpcError({ namespace: 'assetsIPC', method: methodName }, err);
    console.error(e);
    throw e;
  }
}

export const assetsIPC = {
  isAvailable(): boolean {
    return hasAssets();
  },

  has<K extends keyof AssetsApi>(key: K): boolean {
    return hasMethod(key);
  },

  getIconPath(): ReturnType<AssetsApi['getIconPath']> {
    return call('getIconPath', () => requireAssets('getIconPath').getIconPath());
  },
};

export type AssetsIPC = typeof assetsIPC;
