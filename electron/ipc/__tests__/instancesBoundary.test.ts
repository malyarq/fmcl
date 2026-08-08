import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('instances IPC boundary wiring', () => {
  it('registers the Plan 12 handlers with only composition-owned authority', async () => {
    const source = await readFile(new URL('../ipcManager.ts', import.meta.url), 'utf8');

    expect(source).toContain("import { createInstancesHandlers } from './handlers/instancesHandlers'");
    expect(source).toContain('createInstancesHandlers({ application, getDefaultInstanceRoot })');
    expect(source).toContain('Object.values(INSTANCE_CHANNELS)');
    expect(source).toContain('ipcMain.handle(channel');
    expect(source).not.toMatch(/createInstancesHandlers\([^\n]*(?:instanceContent|rootPath)/);
  });

  it('exposes one typed instances namespace through preload', async () => {
    const [bridge, preload] = await Promise.all([
      readFile(new URL('../../preload/bridges/InstancesBridge.ts', import.meta.url), 'utf8'),
      readFile(new URL('../../preload.ts', import.meta.url), 'utf8'),
    ]);

    expect(bridge).toContain("type InstancesAPI");
    expect(bridge).toContain('INSTANCE_CHANNELS');
    expect(bridge).not.toMatch(/modpacks|instanceContent|rootPath/);
    expect(preload).toContain("import { instances } from './preload/bridges/InstancesBridge'");
    expect(preload).toMatch(/const api: BurrowApi = \{[\s\S]*\binstances,\n[\s\S]*\n\}/);
    expect(preload.match(/\binstances,\n/g)).toHaveLength(1);

    const exposedNamespaces = Array.from(
      preload.matchAll(/contextBridge\.exposeInMainWorld\((['"])([^'"]+)\1/g),
      (match) => match[2],
    );
    expect(exposedNamespaces).toEqual(['api']);
  });
});
