import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFile } from 'node:fs/promises';

import { instancesIPC } from '../instancesIPC';

describe('instancesIPC', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('delegates every typed command to the sole window.api instances capability', async () => {
    const instances = {
      list: vi.fn().mockResolvedValue({ ok: true, value: { status: 'uninitialized' } }),
      snapshot: vi.fn().mockResolvedValue({ ok: false, error: { code: 'INSTANCE_NOT_FOUND', message: 'missing' } }),
      select: vi.fn().mockResolvedValue({ ok: true, value: { status: 'noop', selectedId: null, instances: [] } }),
      create: vi.fn().mockResolvedValue({ ok: true, value: { status: 'committed', selectedId: 'alpha', instances: [] } }),
      rename: vi.fn().mockResolvedValue({ ok: true, value: { status: 'committed', selectedId: 'alpha', instances: [] } }),
      config: vi.fn().mockResolvedValue({ ok: false, error: { code: 'INSTANCE_UNAVAILABLE', message: 'unavailable' } }),
      metadata: vi.fn().mockResolvedValue({ ok: false, error: { code: 'INSTANCE_NOT_FOUND', message: 'missing' } }),
      prepare: vi.fn().mockResolvedValue({ ok: true, value: { status: 'ready' } }),
    };
    vi.stubGlobal('window', { api: { instances } });

    await instancesIPC.list();
    await instancesIPC.snapshot({ id: 'alpha' });
    await instancesIPC.select({ id: 'alpha' });
    await instancesIPC.create({ name: 'Alpha', source: { source: 'local' }, config: { runtime: { minecraftVersion: '1.21.1' } } });
    await instancesIPC.rename({ id: 'alpha', name: 'Renamed' });
    await instancesIPC.config({ action: 'get', id: 'alpha' });
    await instancesIPC.metadata({ id: 'alpha' });
    await instancesIPC.prepare();

    expect(instances.snapshot).toHaveBeenCalledWith({ id: 'alpha' });
    expect(instances.create).toHaveBeenCalledWith({ name: 'Alpha', source: { source: 'local' }, config: { runtime: { minecraftVersion: '1.21.1' } } });
    expect(instances.prepare).toHaveBeenCalledWith();
  });

  it('uses no raw IPC, native import, or legacy modpacks facade', async () => {
    const source = await readFile(new URL('../instancesIPC.ts', import.meta.url), 'utf8');

    expect(source).toMatch(/api\?\.instances/);
    expect(source).not.toMatch(/ipcRenderer|from ['"]electron['"]|modpacks|instances:/);
  });
});
