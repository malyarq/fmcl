import { afterEach, describe, expect, it, vi } from 'vitest';
import { PROVIDER_CATALOG_CHANNELS } from '../../../../shared/contracts/providerCatalog';

const mocked = vi.hoisted(() => ({
  handlers: new Map<string, (...args: unknown[]) => unknown>(),
}));

vi.mock('electron', () => ({
  ipcMain: {
    removeHandler: (channel: string) => mocked.handlers.delete(channel),
    handle: (channel: string, handler: (...args: unknown[]) => unknown) => mocked.handlers.set(channel, handler),
  },
}));

import { registerProviderCatalogHandlers } from '../providerCatalogHandlers';

function createAdapter() {
  return {
    searchCurseForgeModpacks: vi.fn(),
    searchModrinthModpacks: vi.fn(),
    getCurseForgeModpackVersions: vi.fn(),
    getModrinthModpackVersions: vi.fn(),
  };
}

describe('provider catalog IPC handlers', () => {
  afterEach(() => {
    mocked.handlers.clear();
    vi.restoreAllMocks();
  });

  it('passes validated provider search input through without changing pagination metadata', async () => {
    const adapter = createAdapter();
    const result = { items: [{ platform: 'modrinth' as const, projectId: 'alpha', title: 'Alpha' }], total: 135, offset: 120, limit: 10 };
    adapter.searchModrinthModpacks.mockResolvedValue(result);
    registerProviderCatalogHandlers({ providerCatalog: adapter });

    const search = mocked.handlers.get(PROVIDER_CATALOG_CHANNELS.search);
    await expect(search?.({}, {
      platform: 'modrinth',
      query: ' alpha ',
      minecraftVersion: '1.21.1',
      loader: 'fabric',
      sort: 'alphabetical',
      offset: 120,
      limit: 10,
    })).resolves.toEqual(result);

    expect(adapter.searchModrinthModpacks).toHaveBeenCalledWith(
      'alpha',
      '1.21.1',
      'fabric',
      'alphabetical',
      120,
      10,
    );
    expect(adapter.searchCurseForgeModpacks).not.toHaveBeenCalled();
  });

  it('validates unknown payload fields and unsafe pagination before calling the adapter', async () => {
    const adapter = createAdapter();
    registerProviderCatalogHandlers({ providerCatalog: adapter });
    const search = mocked.handlers.get(PROVIDER_CATALOG_CHANNELS.search);

    await expect(search?.({}, { platform: 'modrinth', query: '', rootPath: '/private/root' })).rejects.toThrow(/unsupported field/i);
    await expect(search?.({}, { platform: 'modrinth', query: '', offset: -1 })).rejects.toThrow(/offset/i);
    await expect(search?.({}, { platform: 'other', query: '' })).rejects.toThrow(/platform/i);

    expect(adapter.searchCurseForgeModpacks).not.toHaveBeenCalled();
    expect(adapter.searchModrinthModpacks).not.toHaveBeenCalled();
  });

  it('routes provider version requests with validated provider-specific project identifiers', async () => {
    const adapter = createAdapter();
    const curseforgeVersions = [{ platform: 'curseforge' as const, versionId: '4', name: 'Release', mcVersions: [], loaders: [], files: [] }];
    const modrinthVersions = [{ platform: 'modrinth' as const, versionId: 'release', name: 'Release', mcVersions: [], loaders: [], files: [] }];
    adapter.getCurseForgeModpackVersions.mockResolvedValue(curseforgeVersions);
    adapter.getModrinthModpackVersions.mockResolvedValue(modrinthVersions);
    registerProviderCatalogHandlers({ providerCatalog: adapter });

    const versions = mocked.handlers.get(PROVIDER_CATALOG_CHANNELS.versions);
    await expect(versions?.({}, { platform: 'curseforge', projectId: '42' })).resolves.toEqual(curseforgeVersions);
    await expect(versions?.({}, { platform: 'modrinth', projectId: 'alpha-pack' })).resolves.toEqual(modrinthVersions);
    await expect(versions?.({}, { platform: 'curseforge', projectId: '../private' })).rejects.toThrow(/project id/i);

    expect(adapter.getCurseForgeModpackVersions).toHaveBeenCalledWith(42);
    expect(adapter.getModrinthModpackVersions).toHaveBeenCalledWith('alpha-pack');
  });

  it('preserves provider errors instead of converting them to a catalog result', async () => {
    const adapter = createAdapter();
    adapter.searchCurseForgeModpacks.mockRejectedValue(new Error('CurseForge API key is not configured.'));
    registerProviderCatalogHandlers({ providerCatalog: adapter });

    const search = mocked.handlers.get(PROVIDER_CATALOG_CHANNELS.search);
    await expect(search?.({}, { platform: 'curseforge', query: '' })).rejects.toThrow('CurseForge API key is not configured.');
  });
});
