import type { BurrowApi } from '@shared/contracts';
import type { InstanceModRegistrationRequest } from '@shared/contracts/instanceMods';
import type { ModEntry } from '@shared/types/mods';
import { toIpcError } from './ipcError';

type InstanceModsApi = NonNullable<BurrowApi['instanceMods']>;

function api(): InstanceModsApi {
  const instanceMods = typeof window !== 'undefined' ? window.api?.instanceMods : undefined;
  if (!instanceMods) {
    throw new Error('[instanceModsIPC] instance mods API is not available');
  }
  return instanceMods;
}

async function call<T>(method: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    const ipcError = toIpcError({ namespace: 'instanceModsIPC', method }, error);
    console.error(ipcError);
    throw ipcError;
  }
}

export const instanceModsIPC = {
  isAvailable: () => typeof window !== 'undefined' && Boolean(window.api?.instanceMods),
  list: (instanceId: string) => call('list', () => api().list(instanceId) as Promise<ModEntry[]>),
  remove: (instanceId: string, fileName: string) => call('remove', () => api().remove(instanceId, fileName)),
  setEnabled: (instanceId: string, fileName: string, enabled: boolean) => call(
    'setEnabled',
    () => api().setEnabled(instanceId, fileName, enabled),
  ),
  register: (instanceId: string, request: InstanceModRegistrationRequest) => call(
    'register',
    () => api().register(instanceId, request),
  ),
};

export type InstanceModsIPC = typeof instanceModsIPC;
