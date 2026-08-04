import { ipcRenderer } from 'electron';
import { STORAGE_MAINTENANCE_CHANNELS, type StorageMaintenanceAPI } from '@shared/contracts';

/** Dedicated renderer capability for aggregate storage maintenance only. */
export const storageMaintenance: StorageMaintenanceAPI = {
  getStats: () => ipcRenderer.invoke(STORAGE_MAINTENANCE_CHANNELS.getStats, {}),
  cleanup: () => ipcRenderer.invoke(STORAGE_MAINTENANCE_CHANNELS.cleanup, {}),
};
