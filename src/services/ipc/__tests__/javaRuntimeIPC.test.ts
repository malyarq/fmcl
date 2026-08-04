import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFile } from 'node:fs/promises';
import type { JavaRuntimeAPI } from '@shared/contracts';

import { javaRuntimeIPC } from '../javaRuntimeIPC';

describe('javaRuntimeIPC', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('delegates opaque installation selection to the dedicated preload capability', async () => {
    const javaRuntime = {
      scan: vi.fn<JavaRuntimeAPI['scan']>().mockResolvedValue([
        { id: 'installation-1', version: '21.0.6', majorVersion: 21, arch: 'x64' },
      ]),
      select: vi.fn<JavaRuntimeAPI['select']>().mockResolvedValue({ status: 'selected' }),
    };
    vi.stubGlobal('window', { api: { javaRuntime } });

    await javaRuntimeIPC.scan();
    await javaRuntimeIPC.select({ installationId: 'installation-1' });

    expect(javaRuntime.scan).toHaveBeenCalledWith();
    expect(javaRuntime.select).toHaveBeenCalledWith({ installationId: 'installation-1' });
  });

  it('uses no raw IPC, native import, or legacy modpacks facade', async () => {
    const source = await readFile(new URL('../javaRuntimeIPC.ts', import.meta.url), 'utf8');

    expect(source).toMatch(/api\?\.javaRuntime/);
    expect(source).not.toMatch(/ipcRenderer|from ['"]electron['"]|modpacks/);
  });
});
