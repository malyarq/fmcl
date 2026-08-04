import type { FriendLauncherApi } from '@shared/contracts';
import { toIpcError } from './ipcError';

type StorageMaintenanceApi = FriendLauncherApi['storageMaintenance'];

function api(): StorageMaintenanceApi {
  const storageMaintenance = typeof window !== 'undefined' ? window.api?.storageMaintenance : undefined;
  if (!storageMaintenance) throw new Error('[storageMaintenanceIPC] storage maintenance API is not available');
  return storageMaintenance;
}

async function call<T>(method: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    const ipcError = toIpcError({ namespace: 'storageMaintenanceIPC', method }, error);
    console.error(ipcError);
    throw ipcError;
  }
}

export const storageMaintenanceIPC = {
  isAvailable: () => typeof window !== 'undefined' && Boolean(window.api?.storageMaintenance),
  getStats: () => call('getStats', () => api().getStats()),
  cleanup: () => call('cleanup', () => api().cleanup()),
};

export type StorageMaintenanceIPC = typeof storageMaintenanceIPC;
