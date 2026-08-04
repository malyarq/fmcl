import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFile } from 'node:fs/promises';
import type { ProviderCatalogAPI } from '@shared/contracts';

import { providerCatalogIPC } from '../providerCatalogIPC';

describe('providerCatalogIPC', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('delegates typed catalogue requests to the dedicated preload capability', async () => {
    const providerCatalog = {
      search: vi.fn<ProviderCatalogAPI['search']>().mockResolvedValue({ items: [], total: 0, offset: 0, limit: 12 }),
      versions: vi.fn<ProviderCatalogAPI['versions']>().mockResolvedValue([]),
    };
    vi.stubGlobal('window', { api: { providerCatalog } });

    await providerCatalogIPC.search({
      platform: 'modrinth',
      query: 'alpha',
      sort: 'alphabetical',
      offset: 12,
      limit: 12,
    });
    await providerCatalogIPC.versions({ platform: 'curseforge', projectId: '42' });

    expect(providerCatalog.search).toHaveBeenCalledWith({
      platform: 'modrinth',
      query: 'alpha',
      sort: 'alphabetical',
      offset: 12,
      limit: 12,
    });
    expect(providerCatalog.versions).toHaveBeenCalledWith({ platform: 'curseforge', projectId: '42' });
  });

  it('uses no raw IPC, native import, legacy facade, or type cast', async () => {
    const source = await readFile(new URL('../providerCatalogIPC.ts', import.meta.url), 'utf8');

    expect(source).toMatch(/api\?\.providerCatalog/);
    expect(source).not.toMatch(/ipcRenderer|from ['"]electron['"]|modpacks|\sas\s/);
  });
});
