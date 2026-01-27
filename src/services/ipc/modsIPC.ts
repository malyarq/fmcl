import { toIpcError } from './ipcError';

type ModsApi = Window['mods'];
type NamespacedModsApi = Window['api']['mods'];

type LegacyLauncherMods = Partial<{
  searchMods: (query: Parameters<ModsApi['searchMods']>[0]) => ReturnType<ModsApi['searchMods']>;
  getModVersions: (query: Parameters<ModsApi['getModVersions']>[0]) => ReturnType<ModsApi['getModVersions']>;
  installModFile: (req: Parameters<ModsApi['installModFile']>[0]) => ReturnType<ModsApi['installModFile']>;
}>;

function hasMods(): boolean {
  return typeof window !== 'undefined' && Boolean(window.api?.mods || window.mods);
}

function hasMethod<K extends keyof ModsApi>(key: K): boolean {
  const api = (typeof window !== 'undefined' ? (window.api?.mods ?? window.mods) : undefined) as
    | NamespacedModsApi
    | ModsApi
    | undefined;
  return Boolean(api && typeof api[key] === 'function');
}

function requireMods(methodName: string): ModsApi {
  const api = (typeof window !== 'undefined' ? (window.api?.mods ?? window.mods) : undefined) as
    | NamespacedModsApi
    | ModsApi
    | undefined;
  if (!api) {
    throw new Error(`[modsIPC] mods API is not available (method: ${methodName})`);
  }
  return api;
}

async function call<T>(methodName: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    const e = toIpcError({ namespace: 'modsIPC', method: methodName }, err);
    console.error(e);
    throw e;
  }
}

export const modsIPC = {
  searchMods(query: Parameters<ModsApi['searchMods']>[0]) {
    if (!hasMods() || !hasMethod('searchMods')) {
      const legacy = (window as unknown as { launcher?: unknown }).launcher as LegacyLauncherMods | undefined;
      if (!legacy || typeof legacy.searchMods !== 'function') throw new Error('[modsIPC] No mods API available');
      return legacy.searchMods(query);
    }
    return call('searchMods', () => requireMods('searchMods').searchMods(query));
  },

  getModVersions(query: Parameters<ModsApi['getModVersions']>[0]) {
    if (!hasMods() || !hasMethod('getModVersions')) {
      const legacy = (window as unknown as { launcher?: unknown }).launcher as LegacyLauncherMods | undefined;
      if (!legacy || typeof legacy.getModVersions !== 'function') throw new Error('[modsIPC] No mods API available');
      return legacy.getModVersions(query);
    }
    return call('getModVersions', () => requireMods('getModVersions').getModVersions(query));
  },

  installModFile(req: Parameters<ModsApi['installModFile']>[0]) {
    if (!hasMods() || !hasMethod('installModFile')) {
      const legacy = (window as unknown as { launcher?: unknown }).launcher as LegacyLauncherMods | undefined;
      if (!legacy || typeof legacy.installModFile !== 'function') throw new Error('[modsIPC] No mods API available');
      return legacy.installModFile(req);
    }
    return call('installModFile', () => requireMods('installModFile').installModFile(req));
  },
};

export type ModsIPC = typeof modsIPC;

