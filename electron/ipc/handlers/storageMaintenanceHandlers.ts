import { ipcMain } from 'electron';
import {
  STORAGE_MAINTENANCE_CHANNELS,
  type StorageMaintenanceCleanupResult,
  type StorageMaintenanceStats,
} from '../../../shared/contracts/storageMaintenance';

type StorageMaintenanceAdapter = Readonly<{
  getStats(): Promise<StorageMaintenanceStats>;
  cleanup(): Promise<StorageMaintenanceCleanupResult>;
}>;

type StorageMaintenanceHandlerDependencies = Readonly<{ storageMaintenance: StorageMaintenanceAdapter }>;

function validateEmptyRequest(value: unknown, label: string): void {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an empty plain object.`);
  }

  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new Error(`${label} must be an empty plain object.`);
  }

  const fields = Object.keys(value);
  if (fields.length > 0) {
    throw new Error(`${label} does not accept fields: ${fields.join(', ')}.`);
  }
}

/** Registers aggregate storage maintenance with main-owned deletion authority only. */
export function registerStorageMaintenanceHandlers({ storageMaintenance }: StorageMaintenanceHandlerDependencies): void {
  ipcMain.removeHandler(STORAGE_MAINTENANCE_CHANNELS.getStats);
  ipcMain.handle(STORAGE_MAINTENANCE_CHANNELS.getStats, async (_event, request: unknown) => {
    validateEmptyRequest(request, 'Storage maintenance stats request');
    return await storageMaintenance.getStats();
  });

  ipcMain.removeHandler(STORAGE_MAINTENANCE_CHANNELS.cleanup);
  ipcMain.handle(STORAGE_MAINTENANCE_CHANNELS.cleanup, async (_event, request: unknown) => {
    validateEmptyRequest(request, 'Storage maintenance cleanup request');
    return await storageMaintenance.cleanup();
  });
}
