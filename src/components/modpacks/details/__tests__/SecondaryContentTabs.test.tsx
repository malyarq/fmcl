// @vitest-environment jsdom

import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTranslator } from '../../../../contexts/settings/i18n';
import { ModpackDetailsModsTab } from '../ModpackDetailsModsTab';
import { ModsTab } from '../ModsTab';
import { ResourcePacksTab } from '../ResourcePacksTab';
import { ShadersTab } from '../ShadersTab';
import { WorldDatapacksModal } from '../WorldDatapacksModal';
import { WorldsTab } from '../WorldsTab';

const t = createTranslator('en');
const confirmMock = vi.fn();
const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();
const listMock = vi.fn();
const searchMock = vi.fn();
const getVersionsMock = vi.fn();
const installMock = vi.fn();
const deleteMock = vi.fn();
const enableMock = vi.fn();
const disableMock = vi.fn();
const resourcePackListMock = vi.fn();
const resourcePackEnableMock = vi.fn();
const resourcePackDisableMock = vi.fn();
const resourcePackDeleteMock = vi.fn();
const resourcePackReorderMock = vi.fn();
const shaderListMock = vi.fn();
const worldsListMock = vi.fn();
const instanceModsListMock = vi.fn();
const instanceModsRemoveMock = vi.fn();
const instanceModsSetEnabledMock = vi.fn();

vi.mock('react-virtuoso', () => ({
  Virtuoso: ({
    data,
    itemContent,
  }: {
    data: unknown[];
    itemContent: (index: number, item: unknown) => React.ReactNode;
  }) => <div>{data.map((item, index) => <div key={index}>{itemContent(index, item)}</div>)}</div>,
}));

vi.mock('../../../../contexts/SettingsContext', () => ({
  useSettings: () => ({
    t,
    getAccentStyles: () => ({ className: '', style: undefined }),
    formatDate: (timestamp: number | undefined, unknownText = 'Unknown', options?: Intl.DateTimeFormatOptions) =>
      timestamp ? new Date(timestamp).toLocaleDateString('en-US', options) : unknownText,
    formatNumber: (value: number, options?: Intl.NumberFormatOptions) => new Intl.NumberFormat('en-US', options).format(value),
  }),
}));

vi.mock('../../../../contexts/ConfirmContext', () => ({
  useConfirm: () => ({
    confirm: (...args: unknown[]) => confirmMock(...args),
  }),
}));

vi.mock('../../../../contexts/ToastContext', () => ({
  useToast: () => ({
    success: (...args: unknown[]) => toastSuccessMock(...args),
    error: (...args: unknown[]) => toastErrorMock(...args),
    warning: vi.fn(),
    info: vi.fn(),
    showToast: vi.fn(),
  }),
}));

vi.mock('../../../../services/ipc/externalLinksIPC', () => ({
  externalLinksIPC: {
    open: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../../../services/ipc/datapacksIPC', () => ({
  datapacksIPC: {
    listByInstanceId: (...args: unknown[]) => listMock(...args),
    search: (...args: unknown[]) => searchMock(...args),
    getVersions: (...args: unknown[]) => getVersionsMock(...args),
    installByInstanceId: (...args: unknown[]) => installMock(...args),
    deleteByInstanceId: (...args: unknown[]) => deleteMock(...args),
    enableByInstanceId: (...args: unknown[]) => enableMock(...args),
    disableByInstanceId: (...args: unknown[]) => disableMock(...args),
  },
}));

vi.mock('../../../../services/ipc/resourcePacksIPC', () => ({
  resourcePacksIPC: {
    list: (...args: unknown[]) => resourcePackListMock(...args),
    enable: (...args: unknown[]) => resourcePackEnableMock(...args),
    disable: (...args: unknown[]) => resourcePackDisableMock(...args),
    delete: (...args: unknown[]) => resourcePackDeleteMock(...args),
    reorder: (...args: unknown[]) => resourcePackReorderMock(...args),
  },
}));

vi.mock('../../../../services/ipc/shadersIPC', () => ({
  shadersIPC: {
    list: (...args: unknown[]) => shaderListMock(...args),
    setActive: vi.fn(),
    disable: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('../../../../services/ipc/worldsIPC', () => ({
  worldsIPC: {
    listByInstanceId: (...args: unknown[]) => worldsListMock(...args),
    backupByInstanceId: vi.fn(),
    duplicateByInstanceId: vi.fn(),
    deleteByInstanceId: vi.fn(),
    openFolderByInstanceId: vi.fn(),
  },
}));

vi.mock('../../../../services/ipc/instanceModsIPC', () => ({
  instanceModsIPC: {
    list: (...args: unknown[]) => instanceModsListMock(...args),
    remove: (...args: unknown[]) => instanceModsRemoveMock(...args),
    setEnabled: (...args: unknown[]) => instanceModsSetEnabledMock(...args),
  },
}));

function mockMatchMedia(matches = false) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

function ModsHarness() {
  const [query, setQuery] = React.useState('');
  const [filter, setFilter] = React.useState<'all' | 'enabled' | 'disabled'>('all');

  return (
    <ModpackDetailsModsTab
      mods={[
        {
          id: 'alpha',
          name: 'Alpha Utilities',
          version: '1.0.0',
          loaders: ['fabric'],
          deps: [],
          file: {
            path: '/mods/alpha.jar',
            name: 'alpha.jar',
            size: 12,
            mtimeMs: 1,
          },
          hash: {
            sha1: 'alpha',
          },
          enabled: true,
        },
        {
          id: 'beta',
          name: 'Beta Tweaks',
          version: '2.0.0',
          loaders: ['fabric'],
          deps: [],
          file: {
            path: '/mods/beta.jar.disabled',
            name: 'beta.jar.disabled',
            size: 24,
            mtimeMs: 2,
          },
          hash: {
            sha1: 'beta',
          },
          enabled: false,
        },
        {
          id: 'gamma',
          name: 'Gamma Runtime',
          version: '3.1.0',
          loaders: ['fabric'],
          deps: [
            { id: 'minecraft', versionRange: '[1.20.1]', kind: 'depends' },
            { id: 'fabricloader', versionRange: '[0.17.0]', kind: 'depends' },
            { id: 'alpha', versionRange: '[1.0.0]', kind: 'depends' },
            { id: 'beta', versionRange: '[2.0.0]', kind: 'depends' },
          ],
          file: {
            path: '/mods/gamma.jar',
            name: 'gamma.jar',
            size: 36,
            mtimeMs: 3,
          },
          hash: {
            sha1: 'gamma',
          },
          enabled: true,
        },
      ]}
      loadingMods={false}
      modSearchQuery={query}
      onModSearchQueryChange={setQuery}
      modFilterStatus={filter}
      onModFilterStatusChange={setFilter}
      onAddMod={vi.fn()}
      onRemoveMod={vi.fn().mockResolvedValue(undefined)}
      onModToggle={vi.fn()}
      onRefresh={vi.fn()}
      runtimeContext={{
        minecraft: '1.20.1',
        modLoader: {
          type: 'fabric',
          version: '0.16.9',
        },
      }}
      t={t}
      getAccentStyles={() => ({ className: '', style: undefined })}
    />
  );
}

function ModsUnverifiedRuntimeHarness() {
  return (
    <ModpackDetailsModsTab
      mods={[
        {
          id: 'gamma',
          name: 'Gamma Runtime',
          version: '3.1.0',
          loaders: ['fabric'],
          deps: [
            { id: 'fabricloader', versionRange: '[0.17.0]', kind: 'depends' },
          ],
          file: {
            path: '/mods/gamma.jar',
            name: 'gamma.jar',
            size: 36,
            mtimeMs: 3,
          },
          hash: {
            sha1: 'gamma',
          },
          enabled: true,
        },
      ]}
      loadingMods={false}
      modSearchQuery=""
      onModSearchQueryChange={vi.fn()}
      modFilterStatus="all"
      onModFilterStatusChange={vi.fn()}
      onAddMod={vi.fn()}
      onRemoveMod={vi.fn().mockResolvedValue(undefined)}
      onModToggle={vi.fn()}
      onRefresh={vi.fn()}
      runtimeContext={{
        minecraft: '1.20.1',
        modLoader: {
          type: 'fabric',
        },
      }}
      t={t}
      getAccentStyles={() => ({ className: '', style: undefined })}
    />
  );
}

describe('secondary content tabs', () => {
  beforeEach(() => {
    cleanup();
    mockMatchMedia(false);
    confirmMock.mockReset();
    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();
    listMock.mockReset();
    searchMock.mockReset();
    getVersionsMock.mockReset();
    installMock.mockReset();
    deleteMock.mockReset();
    enableMock.mockReset();
    disableMock.mockReset();
    resourcePackListMock.mockReset();
    resourcePackEnableMock.mockReset();
    resourcePackDisableMock.mockReset();
    resourcePackDeleteMock.mockReset();
    resourcePackReorderMock.mockReset();
    shaderListMock.mockReset();
    worldsListMock.mockReset();
    instanceModsListMock.mockReset();
    instanceModsRemoveMock.mockReset();
    instanceModsSetEnabledMock.mockReset();

    confirmMock.mockResolvedValue(true);
    listMock.mockResolvedValue([
      {
        fileName: 'better-mobs.zip',
        name: 'Better Mobs',
        description: 'Mob tweaks',
        isEnabled: true,
        path: '/world/datapacks/better-mobs.zip',
      },
      {
        fileName: 'dormant-utilities.zip',
        name: 'Dormant Utilities',
        description: 'Disabled world helpers kept around for compatibility.',
        isEnabled: false,
        path: '/world/datapacks/dormant-utilities.zip',
      },
    ]);
    searchMock.mockResolvedValue({
      hits: [
        {
          project_id: 'pack-1',
          title: 'Dungeon Boost',
          description: 'More dungeon variety',
          icon_url: null,
        },
      ],
      total_hits: 1,
    });
    getVersionsMock.mockResolvedValue([{ id: 'version-1' }]);
    installMock.mockResolvedValue({ ok: true });
    deleteMock.mockResolvedValue({ ok: true });
    enableMock.mockResolvedValue({ ok: true });
    disableMock.mockResolvedValue({ ok: true });
    resourcePackListMock.mockResolvedValue([
      {
        fileName: 'faithful-64x.zip',
        name: 'Faithful 64x',
        description: 'Sharper textures and clearer UI contrast for dense detail layouts.',
        iconUrl: null,
        isEnabled: true,
      },
      {
        fileName: 'cozy-ui-refresh.zip',
        name: 'Cozy UI Refresh',
        description: 'Warm menus and softer widgets for long session play.',
        iconUrl: null,
        isEnabled: false,
      },
    ]);
    resourcePackEnableMock.mockResolvedValue({ ok: true });
    resourcePackDisableMock.mockResolvedValue({ ok: true });
    resourcePackDeleteMock.mockResolvedValue({ ok: true });
    resourcePackReorderMock.mockResolvedValue({ ok: true });
    shaderListMock.mockResolvedValue([
      {
        fileName: 'complementary.zip',
        name: 'Complementary Reimagined',
        isActive: true,
      },
    ]);
    worldsListMock.mockResolvedValue([
      {
        folderName: 'alpha-world',
        name: 'Alpha World',
        sizeBytes: 1024,
        lastPlayed: 1_776_000_000_000,
      },
    ]);
    instanceModsListMock.mockResolvedValue([
      {
        id: 'alpha-mod',
        name: 'Alpha Utilities',
        version: '1.0.0',
        loaders: ['fabric'],
        deps: [],
        file: {
          path: 'mods/alpha.jar',
          name: 'alpha.jar',
          size: 12,
          mtimeMs: 1,
        },
        hash: { sha1: 'alpha' },
      },
    ]);
    instanceModsRemoveMock.mockResolvedValue({ ok: true });
    instanceModsSetEnabledMock.mockResolvedValue({ ok: true });
  });

  it('keeps the details mods tab filterable without breaking the refreshed surface copy', async () => {
    render(<ModsHarness />);

    expect(screen.getByText('Review installed mods, toggle them quickly, or jump to their project pages for updates.')).toBeTruthy();
    expect(screen.getByText('Alpha Utilities')).toBeTruthy();
    expect(screen.getByText('Beta Tweaks')).toBeTruthy();
    expect(screen.getByText('Gamma Runtime')).toBeTruthy();

    const controls = screen.getByTestId('mods-workspace-controls');
    expect(controls.firstElementChild?.querySelector('input')).toBeTruthy();
    expect(controls.lastElementChild?.className).toContain('sm:grid-cols-2');
    expect(screen.getByRole('button', { name: '+ Add Mod' }).getAttribute('data-button-geometry')).toBe('catalog-primary');
    expect(screen.getByRole('button', { name: 'Update' }).getAttribute('data-button-geometry')).toBe('catalog-primary');
    expect(screen.getByTestId('mods-summary').querySelectorAll('.text-center')).toHaveLength(2);

    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'disabled' },
    });

    await waitFor(() => {
      expect(screen.queryByText('Alpha Utilities')).toBeNull();
      expect(screen.queryByText('Gamma Runtime')).toBeNull();
      expect(screen.getByText('Beta Tweaks')).toBeTruthy();
    });

    fireEvent.change(screen.getByPlaceholderText('Search mods...'), {
      target: { value: 'beta' },
    });

    expect(screen.getByText('Beta Tweaks')).toBeTruthy();
  });

  it('manages mods through the opaque instance-mods seam', async () => {
    render(<ModsTab instanceId="alpha" />);

    expect(await screen.findByText('Alpha Utilities')).toBeTruthy();
    expect(instanceModsListMock).toHaveBeenCalledWith('alpha');

    fireEvent.click(screen.getByRole('button', { name: 'Disable' }));

    await waitFor(() => {
      expect(instanceModsSetEnabledMock).toHaveBeenCalledWith('alpha', 'alpha.jar', false);
    });
  });

  it('marks runtime-provided dependencies truthfully and formats readable requirement copy', async () => {
    render(<ModsHarness />);

    fireEvent.click(screen.getAllByRole('button', { name: /Gamma Runtime/i })[0]);

    expect(await screen.findByText('Provided by pack runtime')).toBeTruthy();
    expect(screen.getByText('Pack runtime mismatch')).toBeTruthy();
    expect(screen.getByText('Pack runtime 1.20.1')).toBeTruthy();
    expect(screen.getByText('Pack runtime 0.16.9')).toBeTruthy();
    expect(screen.getByText(/requires 1\.20\.1/i)).toBeTruthy();
    expect(screen.getByText(/requires 0\.17\.0/i)).toBeTruthy();
    expect(screen.getByText(/requires 2\.0\.0/i)).toBeTruthy();
    expect(screen.getAllByText('Missing')).toHaveLength(1);
  });

  it('marks runtime dependencies as unverified when the runtime exists but its version is unknown', async () => {
    render(<ModsUnverifiedRuntimeHarness />);

    fireEvent.click(screen.getAllByRole('button', { name: /Gamma Runtime/i })[0]);

    expect(await screen.findByText('Pack runtime version unverified')).toBeTruthy();
    expect(screen.queryByText(/Pack runtime 0\.17\.0/i)).toBeNull();
  });

  it('keeps resource pack summaries explicitly labeled instead of collapsing into raw ratios', async () => {
    render(<ResourcePacksTab instanceId="alpha" />);

    expect(await screen.findByText('Faithful 64x')).toBeTruthy();

    const summary = screen.getByTestId('resourcepacks-summary');
    expect(summary.textContent).toContain('Enabled');
    expect(summary.textContent).toContain('Installed');
    expect(summary.textContent?.includes('1 / 2')).toBe(false);
  });

  it('shows a truthful unavailable resource-pack state instead of reusing the empty card', async () => {
    resourcePackListMock.mockRejectedValue(new Error('[IPC] resource packs failed: Packs directory unavailable'));

    render(<ResourcePacksTab instanceId="alpha" />);

    const errorState = await screen.findByRole('status');
    expect(screen.getByRole('heading', { name: 'Failed to load resource packs' })).toBeTruthy();
    expect(errorState.textContent).toContain('Unavailable');
    expect(errorState.textContent).not.toContain('No resource packs installed');
  });

  it('offers the guided resource-pack route as the next step when installed packs fail to load', async () => {
    const onAddResourcePack = vi.fn();
    resourcePackListMock.mockRejectedValue(new Error('[IPC] resource packs failed: Packs directory unavailable'));

    render(<ResourcePacksTab instanceId="alpha" onAddResourcePack={onAddResourcePack} />);

    expect(await screen.findByRole('heading', { name: 'Failed to load resource packs' })).toBeTruthy();
    const unavailableState = screen.getByRole('status');

    fireEvent.click(within(unavailableState).getByRole('button', { name: '+ Add Resource Pack' }));

    expect(onAddResourcePack).toHaveBeenCalledTimes(1);
  });

  it('offers the guided shader route as the next step when installed shaders fail to load', async () => {
    const onAddShader = vi.fn();
    shaderListMock.mockRejectedValue(new Error('[IPC] shaders failed: Packs directory unavailable'));

    render(<ShadersTab instanceId="alpha" onAddShader={onAddShader} />);

    expect(await screen.findByRole('heading', { name: 'Failed to load shader packs' })).toBeTruthy();
    const unavailableState = screen.getByRole('status');

    fireEvent.click(within(unavailableState).getByRole('button', { name: '+ Add Shader' }));

    expect(onAddShader).toHaveBeenCalledTimes(1);
  });

  it('keeps worlds on the same details workspace grammar as the other content tabs', async () => {
    render(<WorldsTab instanceId="alpha" mcVersion="1.20.1" />);

    expect(await screen.findByText('Alpha World')).toBeTruthy();
    expect(screen.getByText('Saved Worlds')).toBeTruthy();
    expect(screen.getByTestId('worlds-summary').textContent).toContain(
      'World actions stay local to this instance, so you can safely manage saves before launching.',
    );
    expect(screen.getByRole('button', { name: 'Update' })).toBeTruthy();
  });

  it('keeps the datapacks modal on the shared modal scroll region with labeled installed counts', async () => {
    render(
      <WorldDatapacksModal
        isOpen={true}
        onClose={vi.fn()}
        instanceId="alpha"
        worldFolder="world-1"
        worldName="Alpha World"
      />
    );

    expect(await screen.findByText('Better Mobs')).toBeTruthy();

    const summary = screen.getByTestId('world-datapacks-installed-summary');
    expect(summary.textContent).toContain('Enabled');
    expect(summary.textContent).toContain('Installed');
    expect(screen.getByRole('tab', { name: 'Installed' }).getAttribute('data-state')).toBe('active');
    const disabledRow = screen.getByText('Dormant Utilities').closest('[data-state="inactive"]');
    expect(disabledRow).toBeTruthy();
    expect(disabledRow?.className).not.toContain('opacity-75');

    const dialog = screen.getByRole('dialog');
    expect(dialog.querySelectorAll('.overflow-y-auto')).toHaveLength(1);
  });

  it('routes datapack deletion through the shared confirm flow instead of browser confirm', async () => {
    render(
      <WorldDatapacksModal
        isOpen={true}
        onClose={vi.fn()}
        instanceId="alpha"
        worldFolder="world-1"
        worldName="Alpha World"
      />
    );

    expect(await screen.findByText('Better Mobs')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Delete datapack "Better Mobs"?' }));

    await waitFor(() => {
      expect(confirmMock).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(deleteMock).toHaveBeenCalledWith('alpha', 'world-1', 'better-mobs.zip');
    });
  });

  it('installs a searched datapack through the typed IPC seam and returns to installed content', async () => {
    render(
      <WorldDatapacksModal
        isOpen={true}
        onClose={vi.fn()}
        instanceId="alpha"
        worldFolder="world-1"
        worldName="Alpha World"
      />
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Search Modrinth' }));

    expect(screen.getByRole('tab', { name: 'Search Modrinth' }).getAttribute('aria-selected')).toBe('true');

    expect(await screen.findByText('Dungeon Boost')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Install datapack' }));

    await waitFor(() => {
      expect(getVersionsMock).toHaveBeenCalledWith('pack-1');
    });

    await waitFor(() => {
      expect(installMock).toHaveBeenCalledWith('alpha', 'world-1', 'version-1');
    });

    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledWith('Installed datapack "Dungeon Boost"');
    });
  });

  it('shows a dedicated unavailable state when datapack search fails', async () => {
    searchMock.mockRejectedValue(new Error('[IPC] datapack search failed: Modrinth unavailable'));

    render(
      <WorldDatapacksModal
        isOpen={true}
        onClose={vi.fn()}
        instanceId="alpha"
        worldFolder="world-1"
        worldName="Alpha World"
      />
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Search Modrinth' }));

    const errorState = await screen.findByRole('status');
    expect(screen.getByRole('heading', { name: 'Failed to search datapacks' })).toBeTruthy();
    expect(errorState.textContent).toContain('Unavailable');
    expect(errorState.textContent).not.toContain('No datapacks matched your filters');
  });
});
