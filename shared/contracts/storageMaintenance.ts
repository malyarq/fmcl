/**
 * Renderer-safe storage maintenance transport.
 *
 * Storage locations and deletion policy remain main-process capabilities;
 * this contract carries only aggregate measurements and cleanup outcomes.
 */
export const STORAGE_MAINTENANCE_CHANNELS = {
  getStats: 'storageMaintenance:getStats',
  cleanup: 'storageMaintenance:cleanup',
} as const;

export type StorageMaintenanceChannel = (typeof STORAGE_MAINTENANCE_CHANNELS)[keyof typeof STORAGE_MAINTENANCE_CHANNELS];

export type StorageMaintenanceStats = Readonly<{
  totalSize: number;
  dedupedSize: number;
  totalFiles: number;
  storedFiles: number;
}>;

export type StorageMaintenanceCleanupResult = Readonly<{
  freedSize: number;
  deletedFiles: number;
}>;

/** Dedicated typed preload capability for aggregate content-store maintenance. */
export type StorageMaintenanceAPI = Readonly<{
  getStats(): Promise<StorageMaintenanceStats>;
  cleanup(): Promise<StorageMaintenanceCleanupResult>;
}>;
