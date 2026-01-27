import { toIpcError } from './ipcError';

type SettingsApi = Window['settings'];
type NamespacedSettingsApi = Window['api']['settings'];

function getSettingsApi(): NamespacedSettingsApi | SettingsApi | undefined {
  if (typeof window === 'undefined') return undefined;
  if (window.api?.settings) return window.api.settings;
  if (window.settings) return window.settings;
  return undefined;
}

function hasSettings(): boolean {
  return Boolean(getSettingsApi());
}

function hasMethod<K extends keyof SettingsApi>(key: K): boolean {
  const api = getSettingsApi() as SettingsApi | undefined;
  return Boolean(api && typeof api[key] === 'function');
}

function requireSettings(methodName: string): SettingsApi {
  const api = getSettingsApi() as SettingsApi | undefined;
  if (!api) {
    throw new Error(`[settingsIPC] settings API is not available (method: ${methodName})`);
  }
  return api;
}

async function call<T>(methodName: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    const e = toIpcError({ namespace: 'settingsIPC', method: methodName }, err);
    console.error(e);
    throw e;
  }
}

export const settingsIPC = {
  isAvailable(): boolean {
    return hasSettings();
  },

  has<K extends keyof SettingsApi>(key: K): boolean {
    return hasMethod(key);
  },

  selectMinecraftPath(): ReturnType<SettingsApi['selectMinecraftPath']> {
    return call('selectMinecraftPath', () => requireSettings('selectMinecraftPath').selectMinecraftPath());
  },
  openMinecraftPath(path?: Parameters<SettingsApi['openMinecraftPath']>[0]): ReturnType<SettingsApi['openMinecraftPath']> {
    return call('openMinecraftPath', () => requireSettings('openMinecraftPath').openMinecraftPath(path));
  },
  getDefaultMinecraftPath(): ReturnType<SettingsApi['getDefaultMinecraftPath']> {
    return call('getDefaultMinecraftPath', () => requireSettings('getDefaultMinecraftPath').getDefaultMinecraftPath());
  },
};

export type SettingsIPC = typeof settingsIPC;
