import { toIpcError } from './ipcError';

type SettingsApi = Window['api']['settings'];

function getSettingsApi(): SettingsApi | undefined {
  if (typeof window === 'undefined') return undefined;
  return window.api?.settings;
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
  exportBackup(values: Parameters<SettingsApi['exportBackup']>[0]): ReturnType<SettingsApi['exportBackup']> {
    return call('exportBackup', () => requireSettings('exportBackup').exportBackup(values));
  },
  importBackup(): ReturnType<SettingsApi['importBackup']> {
    return call('importBackup', () => requireSettings('importBackup').importBackup());
  },
};

export type SettingsIPC = typeof settingsIPC;
