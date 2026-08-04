import { afterEach, describe, expect, it, vi } from 'vitest';
import { STORAGE_MAINTENANCE_CHANNELS } from '../../../../shared/contracts/storageMaintenance';

const mocked = vi.hoisted(() => ({
  handlers: new Map<string, (...args: unknown[]) => unknown>(),
}));

vi.mock('electron', () => ({
  ipcMain: {
    removeHandler: (channel: string) => mocked.handlers.delete(channel),
    handle: (channel: string, handler: (...args: unknown[]) => unknown) => mocked.handlers.set(channel, handler),
  },
}));

import { registerStorageMaintenanceHandlers } from '../storageMaintenanceHandlers';

function createAdapter() {
  return {
    getStats: vi.fn(),
    cleanup: vi.fn(),
  };
}

describe('storage maintenance IPC handlers', () => {
  afterEach(() => {
    mocked.handlers.clear();
    vi.restoreAllMocks();
  });

  it('returns aggregate stats and cleanup outcomes through the injected adapter', async () => {
    const storageMaintenance = createAdapter();
    const stats = { totalSize: 1000, dedupedSize: 700, totalFiles: 8, storedFiles: 5 };
    const cleanup = { freedSize: 300, deletedFiles: 3 };
    storageMaintenance.getStats.mockResolvedValue(stats);
    storageMaintenance.cleanup.mockResolvedValue(cleanup);
    registerStorageMaintenanceHandlers({ storageMaintenance });

    const getStats = mocked.handlers.get(STORAGE_MAINTENANCE_CHANNELS.getStats);
    const runCleanup = mocked.handlers.get(STORAGE_MAINTENANCE_CHANNELS.cleanup);

    await expect(getStats?.({}, {})).resolves.toEqual(stats);
    await expect(runCleanup?.({}, {})).resolves.toEqual(cleanup);

    expect(storageMaintenance.getStats).toHaveBeenCalledOnce();
    expect(storageMaintenance.cleanup).toHaveBeenCalledOnce();
  });

  it.each([
    { rootPath: '/private/launcher' },
    { filePath: '/private/launcher/content.bin' },
    { target: '../escape' },
    { minAgeMs: 0 },
    ['forged-request'],
  ])('rejects forged cleanup input before deletion: %j', async (request) => {
    const storageMaintenance = createAdapter();
    registerStorageMaintenanceHandlers({ storageMaintenance });
    const runCleanup = mocked.handlers.get(STORAGE_MAINTENANCE_CHANNELS.cleanup);

    await expect(runCleanup?.({}, request)).rejects.toThrow(/storage maintenance cleanup request/i);
    expect(storageMaintenance.cleanup).not.toHaveBeenCalled();
  });

  it('rejects unexpected stats payload before reading storage', async () => {
    const storageMaintenance = createAdapter();
    registerStorageMaintenanceHandlers({ storageMaintenance });
    const getStats = mocked.handlers.get(STORAGE_MAINTENANCE_CHANNELS.getStats);

    await expect(getStats?.({}, { rootPath: '/private/launcher' })).rejects.toThrow(/storage maintenance stats request/i);
    expect(storageMaintenance.getStats).not.toHaveBeenCalled();
  });
});
