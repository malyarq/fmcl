import { toIpcError } from './ipcError';

type AppUpdaterApi = Window['appUpdater'];
type NamespacedAppUpdaterApi = Window['api']['appUpdater'];

function getAppUpdaterApi(): NamespacedAppUpdaterApi | AppUpdaterApi | undefined {
  if (typeof window === 'undefined') return undefined;
  if (window.api?.appUpdater) return window.api.appUpdater;
  if (window.appUpdater) return window.appUpdater;
  return undefined;
}

function hasAppUpdater(): boolean {
  return Boolean(getAppUpdaterApi());
}

function hasMethod<K extends keyof AppUpdaterApi>(key: K): boolean {
  const api = getAppUpdaterApi() as AppUpdaterApi | undefined;
  return Boolean(api && typeof api[key] === 'function');
}

function requireAppUpdater(methodName: string): AppUpdaterApi {
  const api = getAppUpdaterApi() as AppUpdaterApi | undefined;
  if (!api) {
    throw new Error(`[appUpdaterIPC] app updater API is not available (method: ${methodName})`);
  }
  return api;
}

async function call<T>(methodName: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    const e = toIpcError({ namespace: 'appUpdaterIPC', method: methodName }, err);
    console.error(e);
    throw e;
  }
}

export const appUpdaterIPC = {
  isAvailable(): boolean {
    return hasAppUpdater();
  },

  has<K extends keyof AppUpdaterApi>(key: K): boolean {
    return hasMethod(key);
  },

  check(): ReturnType<AppUpdaterApi['check']> {
    return call('check', () => requireAppUpdater('check').check());
  },

  quitAndInstall(): ReturnType<AppUpdaterApi['quitAndInstall']> {
    try {
      return requireAppUpdater('quitAndInstall').quitAndInstall();
    } catch (err) {
      const e = toIpcError({ namespace: 'appUpdaterIPC', method: 'quitAndInstall' }, err);
      console.error(e);
      throw e;
    }
  },

  onStatus(cb: Parameters<AppUpdaterApi['onStatus']>[0]): ReturnType<AppUpdaterApi['onStatus']> {
    return requireAppUpdater('onStatus').onStatus(cb);
  },
  onAvailable(cb: Parameters<AppUpdaterApi['onAvailable']>[0]): ReturnType<AppUpdaterApi['onAvailable']> {
    return requireAppUpdater('onAvailable').onAvailable(cb);
  },
  onNotAvailable(cb: Parameters<AppUpdaterApi['onNotAvailable']>[0]): ReturnType<AppUpdaterApi['onNotAvailable']> {
    return requireAppUpdater('onNotAvailable').onNotAvailable(cb);
  },
  onError(cb: Parameters<AppUpdaterApi['onError']>[0]): ReturnType<AppUpdaterApi['onError']> {
    return requireAppUpdater('onError').onError(cb);
  },
  onProgress(cb: Parameters<AppUpdaterApi['onProgress']>[0]): ReturnType<AppUpdaterApi['onProgress']> {
    return requireAppUpdater('onProgress').onProgress(cb);
  },
  onDownloaded(cb: Parameters<AppUpdaterApi['onDownloaded']>[0]): ReturnType<AppUpdaterApi['onDownloaded']> {
    return requireAppUpdater('onDownloaded').onDownloaded(cb);
  },
};

export type AppUpdaterIPC = typeof appUpdaterIPC;

