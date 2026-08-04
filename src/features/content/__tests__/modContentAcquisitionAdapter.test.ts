import { describe, expect, it, vi } from 'vitest';
import {
  createModContentAcquisitionAdapter,
  type ModContentAcquisitionSelection,
} from '../adapters/modContentAcquisitionAdapter';

const runtime = {
  instanceId: 'alpha',
  minecraftVersion: '1.20.1',
  loader: 'fabric',
} as const;

const item = {
  id: 'modrinth:sodium',
  label: 'Sodium',
  platform: 'modrinth',
  projectId: 'sodium',
  description: 'Rendering engine',
} as const;

const selection = (projectId: string): ModContentAcquisitionSelection => ({
  id: `modrinth:${projectId}`,
  label: projectId === 'sodium' ? 'Sodium' : 'Iris',
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
    instanceMods: {
      register: vi.fn(),
    },
    onCommitted: vi.fn(),
  };
}

describe('modContentAcquisitionAdapter', () => {
  it('normalizes typed mod search, paging and version resolution', async () => {
    const deps = dependencies();
    deps.mods.searchMods.mockResolvedValue({
      items: [{
        platform: 'modrinth',
        projectId: 'sodium',
        title: 'Sodium',
        description: 'Rendering engine',
        iconUrl: 'https://cdn.example/sodium.png',
        downloads: 12_000,
      }],
      total: 41,
    });
    deps.mods.getModVersions.mockResolvedValue([{
      platform: 'modrinth',
      versionId: 'sodium-version',
      name: '1.0.0',
      mcVersions: ['1.20.1'],
      loaders: ['fabric'],
    }]);
    const adapter = createModContentAcquisitionAdapter(deps);

    const page = await adapter.search({
      kind: 'mod',
      query: ' sodium ',
      filters: { platform: 'modrinth', sort: 'date', minecraftVersion: '1.20.2', loader: 'forge' },
      page: 20,
      runtime,
    });

    expect(deps.mods.searchMods).toHaveBeenCalledWith({
      platform: 'modrinth',
      query: 'sodium',
      mcVersion: '1.20.2',
      loader: 'forge',
      sort: 'date',
      offset: 20,
      limit: 20,
      contentType: 'mod',
    });
    expect(page).toEqual({ items: [expect.objectContaining(item)], total: 41, nextPage: 21 });

    await expect(adapter.resolveSelection({ item: page.items[0], filters: {}, runtime })).resolves.toEqual(
      expect.objectContaining(selection('sodium')),
    );
    expect(deps.mods.getModVersions).toHaveBeenCalledWith({
      platform: 'modrinth',
      projectId: 'sodium',
      mcVersion: '1.20.1',
      loader: 'fabric',
    });
  });

  it('publishes complete success only after file installation, manifest registration and invalidation', async () => {
    const deps = dependencies();
    deps.mods.installModFile.mockResolvedValue({ status: 'success', filename: 'sodium.jar', issues: [] });
    deps.instanceMods.register.mockResolvedValue(undefined);
    const adapter = createModContentAcquisitionAdapter(deps);

    const outcome = await adapter.install({ selections: [selection('sodium')], runtime });

    expect(deps.mods.installModFile).toHaveBeenCalledWith({
      platform: 'modrinth', projectId: 'sodium', versionId: 'sodium-version', instanceId: 'alpha', contentType: 'mod',
    });
    expect(deps.instanceMods.register).toHaveBeenCalledWith('alpha', {
      platform: 'modrinth', projectId: 'sodium', versionId: 'sodium-version',
    });
    expect(deps.onCommitted).toHaveBeenCalledTimes(1);
    expect(outcome).toEqual({
      didCommit: true,
      isPresentationSuccess: true,
      committedSelectionIds: ['modrinth:sodium'],
      retainedSelectionIds: [],
      issues: [],
    });
  });

  it('invalidates a partial commit, retains only failed picks and never reports presentation success', async () => {
    const deps = dependencies();
    deps.mods.installModFile
      .mockResolvedValueOnce({ status: 'success', issues: [] })
      .mockRejectedValueOnce(new Error('download failed'));
    deps.instanceMods.register.mockResolvedValue(undefined);
    const adapter = createModContentAcquisitionAdapter(deps);

    const outcome = await adapter.install({
      selections: [selection('sodium'), selection('iris')],
      runtime,
    });

    expect(deps.onCommitted).toHaveBeenCalledTimes(1);
    expect(outcome.didCommit).toBe(true);
    expect(outcome.isPresentationSuccess).toBe(false);
    expect(outcome.committedSelectionIds).toEqual(['modrinth:sodium']);
    expect(outcome.retainedSelectionIds).toEqual(['modrinth:iris']);
    expect(outcome.issues).toEqual([expect.objectContaining({
      selectionId: 'modrinth:iris',
      code: 'install-failure',
    })]);
  });

  it('retries manifest registration without downloading an already committed file twice', async () => {
    const deps = dependencies();
    deps.mods.installModFile.mockResolvedValue({ status: 'success', issues: [] });
    deps.instanceMods.register
      .mockRejectedValueOnce(new Error('manifest unavailable'))
      .mockResolvedValueOnce(undefined);
    const adapter = createModContentAcquisitionAdapter(deps);

    const first = await adapter.install({ selections: [selection('sodium')], runtime });
    const second = await adapter.install({ selections: [selection('sodium')], runtime });

    expect(first).toMatchObject({
      didCommit: true,
      isPresentationSuccess: false,
      retainedSelectionIds: ['modrinth:sodium'],
      issues: [expect.objectContaining({ code: 'manifest-failure' })],
    });
    expect(second).toMatchObject({
      didCommit: true,
      isPresentationSuccess: true,
      retainedSelectionIds: [],
    });
    expect(deps.mods.installModFile).toHaveBeenCalledTimes(1);
    expect(deps.instanceMods.register).toHaveBeenCalledTimes(2);
    expect(deps.onCommitted).toHaveBeenCalledTimes(2);
  });

  it('keeps a committed install degraded when canonical invalidation fails', async () => {
    const deps = dependencies();
    deps.mods.installModFile.mockResolvedValue({ status: 'success', issues: [] });
    deps.instanceMods.register.mockResolvedValue(undefined);
    deps.onCommitted.mockRejectedValue(new Error('invalidation unavailable'));
    const adapter = createModContentAcquisitionAdapter(deps);

    const outcome = await adapter.install({ selections: [selection('sodium')], runtime });

    expect(outcome).toMatchObject({
      didCommit: true,
      isPresentationSuccess: false,
      committedSelectionIds: ['modrinth:sodium'],
      retainedSelectionIds: [],
      issues: [expect.objectContaining({ code: 'unknown' })],
    });
  });

  it.each([
    ['duplicate', 'duplicate'],
    ['invalid-archive', 'invalid-archive'],
    ['runtime-blocked', 'runtime-blocked'],
    ['failure', 'install-failure'],
  ] as const)('normalizes a %s install result as a retained %s issue', async (status, code) => {
    const deps = dependencies();
    deps.mods.installModFile.mockResolvedValue({
      status,
      issues: [{ fileName: 'sodium.jar', status, message: 'provider detail' }],
    });
    const adapter = createModContentAcquisitionAdapter(deps);

    const outcome = await adapter.install({ selections: [selection('sodium')], runtime });

    expect(outcome).toMatchObject({
      didCommit: false,
      isPresentationSuccess: false,
      committedSelectionIds: [],
      retainedSelectionIds: ['modrinth:sodium'],
      issues: [expect.objectContaining({ code })],
    });
    expect(deps.instanceMods.register).not.toHaveBeenCalled();
    expect(deps.onCommitted).not.toHaveBeenCalled();
  });
});
