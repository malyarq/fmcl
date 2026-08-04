import { describe, expect, it, vi } from 'vitest';
import {
  createShaderContentAcquisitionAdapter,
  type ShaderContentAcquisitionSelection,
} from '../adapters/shaderContentAcquisitionAdapter';

const runtime = {
  instanceId: 'alpha',
  minecraftVersion: '1.20.1',
  shaderSupport: 'supported',
} as const;

const selection = (projectId: string): ShaderContentAcquisitionSelection => ({
  id: `modrinth:${projectId}`,
  label: projectId === 'complementary' ? 'Complementary Reimagined' : 'MakeUp Ultra Fast',
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
    shaders: {
      add: vi.fn(),
    },
    onCommitted: vi.fn(),
  };
}

describe('shaderContentAcquisitionAdapter', () => {
  it('normalizes shader search and version resolution without a loader constraint', async () => {
    const deps = dependencies();
    deps.mods.searchMods.mockResolvedValue({
      items: [{
        platform: 'modrinth',
        projectId: 'complementary',
        title: 'Complementary Reimagined',
        description: 'Cinematic lighting',
        downloads: 84_000,
      }],
      total: 22,
    });
    deps.mods.getModVersions.mockResolvedValue([{
      platform: 'modrinth',
      versionId: 'complementary-version',
      name: '1.0.0',
      mcVersions: ['1.20.1'],
      loaders: ['iris'],
    }]);
    const adapter = createShaderContentAcquisitionAdapter(deps);

    const page = await adapter.search({
      kind: 'shader',
      query: ' complementary ',
      filters: { platform: 'modrinth', sort: 'date', minecraftVersion: '1.20.2' },
      page: 20,
      runtime,
    });

    expect(deps.mods.searchMods).toHaveBeenCalledWith({
      platform: 'modrinth',
      query: 'complementary',
      mcVersion: '1.20.2',
      sort: 'date',
      offset: 20,
      limit: 20,
      contentType: 'shader',
    });
    expect(page).toEqual({
      items: [expect.objectContaining({
        id: 'modrinth:complementary',
        label: 'Complementary Reimagined',
        projectId: 'complementary',
      })],
      total: 22,
      nextPage: 21,
    });

    await expect(adapter.resolveSelection({ item: page.items[0], filters: {}, runtime })).resolves.toEqual(
      expect.objectContaining(selection('complementary')),
    );
    expect(deps.mods.getModVersions).toHaveBeenCalledWith({
      platform: 'modrinth',
      projectId: 'complementary',
      mcVersion: '1.20.1',
      contentType: 'shader',
    });
  });

  it('blocks provider installs when the canonical runtime says shaders are unsupported', async () => {
    const deps = dependencies();
    const adapter = createShaderContentAcquisitionAdapter(deps);

    const outcome = await adapter.install({
      selections: [selection('complementary')],
      runtime: { ...runtime, shaderSupport: 'unsupported' },
    });

    expect(outcome).toEqual({
      didCommit: false,
      isPresentationSuccess: false,
      committedSelectionIds: [],
      retainedSelectionIds: ['modrinth:complementary'],
      issues: [{
        selectionId: 'modrinth:complementary',
        label: 'Complementary Reimagined',
        code: 'runtime-blocked',
      }],
    });
    expect(deps.mods.installModFile).not.toHaveBeenCalled();
    expect(deps.onCommitted).not.toHaveBeenCalled();
  });

  it('invalidates one partial commit and retains only failed catalog selections', async () => {
    const deps = dependencies();
    deps.mods.installModFile
      .mockResolvedValueOnce({ status: 'success', filename: 'complementary.zip', issues: [] })
      .mockResolvedValueOnce({
        status: 'duplicate',
        issues: [{ fileName: 'makeup.zip', status: 'duplicate', message: 'Already installed' }],
      });
    const adapter = createShaderContentAcquisitionAdapter(deps);

    const outcome = await adapter.install({
      selections: [selection('complementary'), selection('makeup')],
      runtime,
    });

    expect(deps.onCommitted).toHaveBeenCalledTimes(1);
    expect(outcome).toEqual({
      didCommit: true,
      isPresentationSuccess: false,
      committedSelectionIds: ['modrinth:complementary'],
      retainedSelectionIds: ['modrinth:makeup'],
      issues: [{
        selectionId: 'modrinth:makeup',
        label: 'MakeUp Ultra Fast',
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
      issues: [{ fileName: 'complementary.zip', status, message: 'provider detail' }],
    });
    const adapter = createShaderContentAcquisitionAdapter(deps);

    const outcome = await adapter.install({ selections: [selection('complementary')], runtime });

    expect(outcome).toMatchObject({
      didCommit: false,
      isPresentationSuccess: false,
      committedSelectionIds: [],
      retainedSelectionIds: ['modrinth:complementary'],
      issues: [{ selectionId: 'modrinth:complementary', code }],
    });
    expect(deps.onCommitted).not.toHaveBeenCalled();
  });

  it('retries canonical invalidation without downloading a committed shader twice', async () => {
    const deps = dependencies();
    deps.mods.installModFile.mockResolvedValue({ status: 'success', filename: 'complementary.zip', issues: [] });
    deps.onCommitted
      .mockRejectedValueOnce(new Error('canonical refresh unavailable'))
      .mockResolvedValueOnce(undefined);
    const adapter = createShaderContentAcquisitionAdapter(deps);

    const first = await adapter.install({ selections: [selection('complementary')], runtime });
    const second = await adapter.install({ selections: [selection('complementary')], runtime });

    expect(first).toMatchObject({
      didCommit: true,
      isPresentationSuccess: false,
      retainedSelectionIds: ['modrinth:complementary'],
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

  it('normalizes a partial local import and invalidates only after a committed file', async () => {
    const deps = dependencies();
    deps.shaders.add.mockResolvedValue({
      status: 'partial-success',
      importedFileNames: ['complementary.zip'],
      issues: [{
        fileName: '/private/tmp/broken.zip',
        status: 'invalid-archive',
        message: 'Invalid shader archive',
      }],
    });
    const adapter = createShaderContentAcquisitionAdapter(deps);

    const outcome = await adapter.importLocal?.({ runtime });

    expect(deps.shaders.add).toHaveBeenCalledWith('alpha');
    expect(deps.onCommitted).toHaveBeenCalledTimes(1);
    expect(outcome).toEqual({
      didCommit: true,
      isPresentationSuccess: false,
      committedSelectionIds: ['local:complementary.zip'],
      retainedSelectionIds: ['local:broken.zip'],
      issues: [{
        selectionId: 'local:broken.zip',
        label: 'broken.zip',
        code: 'invalid-archive',
      }],
    });
  });

  it.each([
    ['cancelled', [], []],
    ['duplicate', [], [{ fileName: 'complementary.zip', status: 'duplicate', message: 'Already installed' }]],
    ['runtime-blocked', [], [{ fileName: 'complementary.zip', status: 'runtime-blocked', message: 'Needs Iris' }]],
    ['failure', [], [{ fileName: 'complementary.zip', status: 'failure', message: 'Copy failed' }]],
  ] as const)('does not invalidate a non-committed local %s result', async (status, importedFileNames, issues) => {
    const deps = dependencies();
    deps.shaders.add.mockResolvedValue({ status, importedFileNames, issues });
    const adapter = createShaderContentAcquisitionAdapter(deps);

    const outcome = await adapter.importLocal?.({ runtime });

    expect(outcome?.didCommit).toBe(false);
    expect(outcome?.isPresentationSuccess).toBe(false);
    expect(deps.onCommitted).not.toHaveBeenCalled();
  });

  it('retries failed local canonical invalidation without reopening the native picker', async () => {
    const deps = dependencies();
    deps.shaders.add.mockResolvedValue({
      status: 'success',
      importedFileNames: ['complementary.zip'],
      issues: [],
    });
    deps.onCommitted
      .mockRejectedValueOnce(new Error('canonical refresh unavailable'))
      .mockResolvedValueOnce(undefined);
    const adapter = createShaderContentAcquisitionAdapter(deps);

    const first = await adapter.importLocal?.({ runtime });
    const second = await adapter.importLocal?.({ runtime });

    expect(first).toMatchObject({
      didCommit: true,
      isPresentationSuccess: false,
      retainedSelectionIds: ['local:complementary.zip'],
      issues: [expect.objectContaining({ code: 'unknown' })],
    });
    expect(second).toMatchObject({
      didCommit: true,
      isPresentationSuccess: true,
      retainedSelectionIds: [],
    });
    expect(deps.shaders.add).toHaveBeenCalledTimes(1);
    expect(deps.onCommitted).toHaveBeenCalledTimes(2);
  });
});
