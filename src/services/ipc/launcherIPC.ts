import { toIpcError } from './ipcError';

type LauncherApi = Window['launcher'];
type NamespacedLauncherApi = Window['api']['launcher'];

function getLauncherApi(): NamespacedLauncherApi | LauncherApi | undefined {
  if (typeof window === 'undefined') return undefined;
  if (window.api?.launcher) return window.api.launcher;
  if (window.launcher) return window.launcher;
  return undefined;
}

function hasLauncher(): boolean {
  return Boolean(getLauncherApi());
}

function hasMethod<K extends keyof LauncherApi>(key: K): boolean {
  const api = getLauncherApi() as LauncherApi | undefined;
  return Boolean(api && typeof api[key] === 'function');
}

function requireLauncher(methodName: string): LauncherApi {
  const api = getLauncherApi() as LauncherApi | undefined;
  if (!api) {
    throw new Error(`[launcherIPC] launcher API is not available (method: ${methodName})`);
  }
  return api;
}

async function call<T>(methodName: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    const e = toIpcError({ namespace: 'launcherIPC', method: methodName }, err);
    console.error(e);
    throw e;
  }
}

export const launcherIPC = {
  isAvailable(): boolean {
    return hasLauncher();
  },

  has<K extends keyof LauncherApi>(key: K): boolean {
    return hasMethod(key);
  },

  // events
  onLog(callback: (log: string) => void): () => void {
    if (!hasMethod('onLog')) return () => {};
    return requireLauncher('onLog').onLog(callback);
  },
  onProgress(callback: (progress: { type: string; task: number; total: number }) => void): () => void {
    if (!hasMethod('onProgress')) return () => {};
    return requireLauncher('onProgress').onProgress(callback);
  },
  onClose(callback: (code: number) => void): () => void {
    if (!hasMethod('onClose')) return () => {};
    return requireLauncher('onClose').onClose(callback);
  },

  // launcher
  killAndRestart(): Promise<void> {
    return call('killAndRestart', () => requireLauncher('killAndRestart').killAndRestart());
  },
  launch(options: Parameters<LauncherApi['launch']>[0]): Promise<void> {
    return call('launch', () => requireLauncher('launch').launch(options));
  },
  getVersionList(providerId?: Parameters<LauncherApi['getVersionList']>[0]): ReturnType<LauncherApi['getVersionList']> {
    return call('getVersionList', () => requireLauncher('getVersionList').getVersionList(providerId));
  },
  getForgeSupportedVersions(providerId?: Parameters<LauncherApi['getForgeSupportedVersions']>[0]): ReturnType<LauncherApi['getForgeSupportedVersions']> {
    return call('getForgeSupportedVersions', () => requireLauncher('getForgeSupportedVersions').getForgeSupportedVersions(providerId));
  },
  getFabricSupportedVersions(): ReturnType<LauncherApi['getFabricSupportedVersions']> {
    return call('getFabricSupportedVersions', () => requireLauncher('getFabricSupportedVersions').getFabricSupportedVersions());
  },
  getOptiFineSupportedVersions(): ReturnType<LauncherApi['getOptiFineSupportedVersions']> {
    return call('getOptiFineSupportedVersions', () => requireLauncher('getOptiFineSupportedVersions').getOptiFineSupportedVersions());
  },
  getNeoForgeSupportedVersions(providerId?: Parameters<LauncherApi['getNeoForgeSupportedVersions']>[0]): ReturnType<LauncherApi['getNeoForgeSupportedVersions']> {
    return call('getNeoForgeSupportedVersions', () => requireLauncher('getNeoForgeSupportedVersions').getNeoForgeSupportedVersions(providerId));
  },
};

export type LauncherIPC = typeof launcherIPC;
