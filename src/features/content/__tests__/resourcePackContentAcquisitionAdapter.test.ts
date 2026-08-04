import { describe, expect, it, vi } from 'vitest';
import {
  createResourcePackContentAcquisitionAdapter,
  type ResourcePackContentAcquisitionSelection,
} from '../adapters/resourcePackContentAcquisitionAdapter';

const runtime = {
  instanceId: 'alpha',
  minecraftVersion: '1.20.1',
} as const;

const selection = (projectId: string): ResourcePackContentAcquisitionSelection => ({
  id: `modrinth:${projectId}`,
  label: projectId === 'faithful' ? 'Faithful 64x' : 'Fresh Animations',
  platform: 'modrinth',
  projectId,
  versionId: `${projectId}-version`,
  versionLabel: '1.0.0',
});

function dependencies() {
  return {
    mods: {
      searchMods: vi.fn(),
      getModVersions: vi.fn(),
      installModFile: vi.fn(),
    },
    resourcePacks: {
      add: vi.fn(),
    },
    onCommitted: vi.fn(),
  };
}

describe('resourcePackContentAcquisitionAdapter', () => {
  it('normalizes resource-pack search and version resolution without loader or mod-manifest assumptions', async () => {
    const deps = dependencies();
    deps.mods.searchMods.mockResolvedValue({
      items: [{
        platform: 'modrinth',
        projectId: 'faithful',
        title: 'Faithful 64x',
        description: 'Sharper textures',
        downloads: 42_000,
      }],
      total: 22,
    });
    deps.mods.getModVersions.mockResolvedValue([{
      platform: 'modrinth',
      versionId: 'faithful-version',
      name: '1.0.0',
      mcVersions: ['1.20.1'],
      loaders: [],
    }]);
    const adapter = createResourcePackContentAcquisitionAdapter(deps);

    const page = await adapter.search({
      kind: 'resourcepack',
      query: ' faithful ',
      filters: { platform: 'modrinth', sort: 'date', minecraftVersion: '1.20.2' },
      page: 20,
      runtime,
    });

    expect(deps.mods.searchMods).toHaveBeenCalledWith({
      platform: 'modrinth',
      query: 'faithful',
      mcVersion: '1.20.2',
      sort: 'date',
      offset: 20,
      limit: 20,
      contentType: 'resourcepack',
    });
    expect(page).toEqual({
      items: [expect.objectContaining({
        id: 'modrinth:faithful',
        label: 'Faithful 64x',
        projectId: 'faithful',
      })],
      total: 22,
      nextPage: 21,
    });

    await expect(adapter.resolveSelection({ item: page.items[0], filters: {}, runtime })).resolves.toEqual(
      expect.objectContaining(selection('faithful')),
    );
    expect(deps.mods.getModVersions).toHaveBeenCalledWith({
      platform: 'modrinth',
      projectId: 'faithful',
      mcVersion: '1.20.1',
      contentType: 'resourcepack',
    });
  });

  it('invalidates one partial commit and retains only failed catalog selections', async () => {
    const deps = dependencies();
    deps.mods.installModFile
      .mockResolvedValueOnce({ status: 'success', filename: 'faithful.zip', issues: [] })
      .mockResolvedValueOnce({
        status: 'duplicate',
        issues: [{ fileName: 'fresh.zip', status: 'duplicate', message: 'Already installed' }],
      });
    const adapter = createResourcePackContentAcquisitionAdapter(deps);

    const outcome = await adapter.install({
      selections: [selection('faithful'), selection('fresh')],
      runtime,
    });

    expect(deps.onCommitted).toHaveBeenCalledTimes(1);
    expect(outcome).toEqual({
      didCommit: true,
      isPresentationSuccess: false,
      committedSelectionIds: ['modrinth:faithful'],
      retainedSelectionIds: ['modrinth:fresh'],
      issues: [{
        selectionId: 'modrinth:fresh',
        label: 'Fresh Animations',
        code: 'duplicate',
      }],
    });
  });

  it.each([
    ['duplicate', 'duplicate'],
    ['invalid-archive', 'invalid-archive'],
    ['runtime-blocked', 'runtime-blocked'],
    ['failure', 'install-failure'],
  ] as const)('keeps a non-committed %s catalog result retryable as %s', async (status, code) => {
    const deps = dependencies();
    deps.mods.installModFile.mockResolvedValue({
      status,
      issues: [{ fileName: 'faithful.zip', status, message: 'provider detail' }],
    });
    const adapter = createResourcePackContentAcquisitionAdapter(deps);

    const outcome = await adapter.install({ selections: [selection('faithful')], runtime });

    expect(outcome).toMatchObject({
      didCommit: false,
      isPresentationSuccess: false,
      committedSelectionIds: [],
      retainedSelectionIds: ['modrinth:faithful'],
      issues: [{ selectionId: 'modrinth:faithful', code }],
    });
    expect(deps.onCommitted).not.toHaveBeenCalled();
  });

  it('retries canonical invalidation without downloading an already committed catalog file twice', async () => {
    const deps = dependencies();
    deps.mods.installModFile.mockResolvedValue({ status: 'success', filename: 'faithful.zip', issues: [] });
    deps.onCommitted
      .mockRejectedValueOnce(new Error('canonical refresh unavailable'))
      .mockResolvedValueOnce(undefined);
    const adapter = createResourcePackContentAcquisitionAdapter(deps);

    const first = await adapter.install({ selections: [selection('faithful')], runtime });
    const second = await adapter.install({ selections: [selection('faithful')], runtime });

    expect(first).toMatchObject({
      didCommit: true,
      isPresentationSuccess: false,
      retainedSelectionIds: ['modrinth:faithful'],
      issues: [expect.objectContaining({ code: 'unknown' })],
    });
    expect(second).toMatchObject({
      didCommit: true,
      isPresentationSuccess: true,
      retainedSelectionIds: [],
      issues: [],
    });
    expect(deps.mods.installModFile).toHaveBeenCalledTimes(1);
    expect(deps.onCommitted).toHaveBeenCalledTimes(2);
  });

  it('normalizes partial local import and invalidates only because at least one logical file committed', async () => {
    const deps = dependencies();
    deps.resourcePacks.add.mockResolvedValue({
      status: 'partial-success',
      importedFileNames: ['retro-clean.zip'],
      issues: [{
        fileName: 'retro-broken.zip',
        status: 'invalid-archive',
        message: 'Missing pack.mcmeta',
      }],
    });
    const adapter = createResourcePackContentAcquisitionAdapter(deps);

    const outcome = await adapter.importLocal?.({ runtime });

    expect(deps.resourcePacks.add).toHaveBeenCalledWith('alpha');
    expect(deps.onCommitted).toHaveBeenCalledTimes(1);
    expect(outcome).toEqual({
      didCommit: true,
      isPresentationSuccess: false,
      committedSelectionIds: ['local:retro-clean.zip'],
      retainedSelectionIds: ['local:retro-broken.zip'],
      issues: [{
        selectionId: 'local:retro-broken.zip',
        label: 'retro-broken.zip',
        code: 'invalid-archive',
      }],
    });
  });

  it.each([
    ['cancelled', [], []],
    ['duplicate', [], [{ fileName: 'retro.zip', status: 'duplicate', message: 'Already installed' }]],
    ['failure', [], [{ fileName: 'retro.zip', status: 'failure', message: 'Copy failed' }]],
  ] as const)('does not invalidate a non-committed local %s result', async (status, importedFileNames, issues) => {
    const deps = dependencies();
    deps.resourcePacks.add.mockResolvedValue({ status, importedFileNames, issues });
    const adapter = createResourcePackContentAcquisitionAdapter(deps);

    const outcome = await adapter.importLocal?.({ runtime });

    expect(outcome?.didCommit).toBe(false);
    expect(outcome?.isPresentationSuccess).toBe(false);
    expect(deps.onCommitted).not.toHaveBeenCalled();
  });

  it('retries failed local canonical invalidation without reopening the native picker', async () => {
    const deps = dependencies();
    deps.resourcePacks.add.mockResolvedValue({
      status: 'success',
      importedFileNames: ['retro.zip'],
      issues: [],
    });
    deps.onCommitted
      .mockRejectedValueOnce(new Error('canonical refresh unavailable'))
      .mockResolvedValueOnce(undefined);
    const adapter = createResourcePackContentAcquisitionAdapter(deps);

    const first = await adapter.importLocal?.({ runtime });
    const second = await adapter.importLocal?.({ runtime });

    expect(first).toMatchObject({
      didCommit: true,
      isPresentationSuccess: false,
      retainedSelectionIds: ['local:retro.zip'],
      issues: [expect.objectContaining({ code: 'unknown' })],
    });
    expect(second).toMatchObject({
      didCommit: true,
      isPresentationSuccess: true,
      retainedSelectionIds: [],
    });
    expect(deps.resourcePacks.add).toHaveBeenCalledTimes(1);
    expect(deps.onCommitted).toHaveBeenCalledTimes(2);
  });
});
