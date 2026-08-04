import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('storage maintenance IPC boundary wiring', () => {
  it('registers the dedicated handler with only the composition-owned storage adapter', async () => {
    const source = await readFile(new URL('../ipcManager.ts', import.meta.url), 'utf8');

    expect(source).toContain("import { registerStorageMaintenanceHandlers } from './handlers/storageMaintenanceHandlers'");
    expect(source).toContain('registerStorageMaintenanceHandlers({ storageMaintenance })');
  });

  it('exposes one typed storageMaintenance namespace without modpack or filesystem forwarding', async () => {
    const [bridge, preload, windowApi] = await Promise.all([
      readFile(new URL('../../preload/bridges/StorageMaintenanceBridge.ts', import.meta.url), 'utf8'),
      readFile(new URL('../../preload.ts', import.meta.url), 'utf8'),
      readFile(new URL('../../../shared/contracts/windowApi.ts', import.meta.url), 'utf8'),
    ]);

    expect(bridge).toContain('StorageMaintenanceAPI');
    expect(bridge).toContain('STORAGE_MAINTENANCE_CHANNELS');
    expect(bridge).not.toMatch(/modpacks|rootPath|filePath|\bfs\b/);
    expect(windowApi).toContain('storageMaintenance: StorageMaintenanceAPI');
    expect(preload).toContain("import { storageMaintenance } from './preload/bridges/StorageMaintenanceBridge'");
    expect(preload.match(/\bstorageMaintenance,\n/g)).toHaveLength(1);
  });
});
