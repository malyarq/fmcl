import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFile } from 'node:fs/promises';
import type { StorageMaintenanceAPI } from '@shared/contracts';

import { storageMaintenanceIPC } from '../storageMaintenanceIPC';

describe('storageMaintenanceIPC', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('delegates aggregate storage requests to the dedicated preload capability', async () => {
    const storageMaintenance = {
      getStats: vi.fn<StorageMaintenanceAPI['getStats']>().mockResolvedValue({
        totalSize: 1_000,
        dedupedSize: 700,
        totalFiles: 8,
        storedFiles: 5,
      }),
      cleanup: vi.fn<StorageMaintenanceAPI['cleanup']>().mockResolvedValue({
        freedSize: 300,
        deletedFiles: 3,
      }),
    };
    vi.stubGlobal('window', { api: { storageMaintenance } });

    await storageMaintenanceIPC.getStats();
    await storageMaintenanceIPC.cleanup();

    expect(storageMaintenance.getStats).toHaveBeenCalledWith();
    expect(storageMaintenance.cleanup).toHaveBeenCalledWith();
  });

  it('uses no raw IPC, native import, or legacy modpacks facade', async () => {
    const source = await readFile(new URL('../storageMaintenanceIPC.ts', import.meta.url), 'utf8');

    expect(source).toMatch(/api\?\.storageMaintenance/);
    expect(source).not.toMatch(/ipcRenderer|from ['"]electron['"]|modpacks/);
  });
});
