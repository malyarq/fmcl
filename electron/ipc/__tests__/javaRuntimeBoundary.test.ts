import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('java runtime IPC boundary wiring', () => {
  it('registers Java runtime handlers with canonical application and main-owned root authority', async () => {
    const source = await readFile(new URL('../ipcManager.ts', import.meta.url), 'utf8');

    expect(source).toContain("import { registerJavaRuntimeHandlers } from './handlers/javaRuntimeHandlers'");
    expect(source).toMatch(/registerJavaRuntimeHandlers\(\{[\s\S]*application,[\s\S]*getDefaultInstanceRoot,[\s\S]*scanJava,[\s\S]*\}\)/);
  });

  it('exposes one typed Java runtime namespace without a legacy transport', async () => {
    const [bridge, preload] = await Promise.all([
      readFile(new URL('../../preload/bridges/JavaRuntimeBridge.ts', import.meta.url), 'utf8'),
      readFile(new URL('../../preload.ts', import.meta.url), 'utf8'),
    ]);

    expect(bridge).toContain('type JavaRuntimeAPI');
    expect(bridge).toContain('JAVA_RUNTIME_CHANNELS');
    expect(bridge).not.toMatch(/modpacks|path:/);
    expect(preload).toContain("import { javaRuntime } from './preload/bridges/JavaRuntimeBridge'");
    expect(preload.match(/\bjavaRuntime,\n/g)).toHaveLength(1);
  });
});
