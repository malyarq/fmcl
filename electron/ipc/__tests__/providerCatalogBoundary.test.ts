import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('provider catalog IPC boundary wiring', () => {
  it('registers the dedicated read-only handler with the injected provider adapter', async () => {
    const source = await readFile(new URL('../ipcManager.ts', import.meta.url), 'utf8');

    expect(source).toContain("import { registerProviderCatalogHandlers } from './handlers/providerCatalogHandlers'");
    expect(source).toContain('registerProviderCatalogHandlers({ providerCatalog: modPlatforms })');
  });

  it('exposes one typed providerCatalog preload namespace without forwarding modpacks', async () => {
    const [bridge, preload, windowApi] = await Promise.all([
      readFile(new URL('../../preload/bridges/ProviderCatalogBridge.ts', import.meta.url), 'utf8'),
      readFile(new URL('../../preload.ts', import.meta.url), 'utf8'),
      readFile(new URL('../../../shared/contracts/windowApi.ts', import.meta.url), 'utf8'),
    ]);

    expect(bridge).toContain('ProviderCatalogAPI');
    expect(bridge).toContain('PROVIDER_CATALOG_CHANNELS');
    expect(bridge).not.toMatch(/modpacks|rootPath|filePath/);
    expect(windowApi).toContain('providerCatalog: ProviderCatalogAPI');
    expect(preload).toContain("import { providerCatalog } from './preload/bridges/ProviderCatalogBridge'");
    expect(preload.match(/\bproviderCatalog,\n/g)).toHaveLength(1);
  });
});
