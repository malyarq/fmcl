// @vitest-environment jsdom

import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTranslator } from '../../../../contexts/settings/i18n';
import { ModpackDetailsModsTab } from '../ModpackDetailsModsTab';
import { WorldDatapacksModal } from '../WorldDatapacksModal';

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
    list: (...args: unknown[]) => listMock(...args),
    search: (...args: unknown[]) => searchMock(...args),
    getVersions: (...args: unknown[]) => getVersionsMock(...args),
    install: (...args: unknown[]) => installMock(...args),
    delete: (...args: unknown[]) => deleteMock(...args),
    enable: (...args: unknown[]) => enableMock(...args),
    disable: (...args: unknown[]) => disableMock(...args),
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

    confirmMock.mockResolvedValue(true);
    listMock.mockResolvedValue([
      {
        fileName: 'better-mobs.zip',
        name: 'Better Mobs',
        description: 'Mob tweaks',
        isEnabled: true,
        path: '/world/datapacks/better-mobs.zip',
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
  });

  it('keeps the details mods tab filterable without breaking the refreshed surface copy', async () => {
    render(<ModsHarness />);

    expect(screen.getByText('Review installed mods, toggle them quickly, or jump to their project pages for updates.')).toBeTruthy();
    expect(screen.getByText('Alpha Utilities')).toBeTruthy();
    expect(screen.getByText('Beta Tweaks')).toBeTruthy();
    expect(screen.getByText('Gamma Runtime')).toBeTruthy();

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

  it('routes datapack deletion through the shared confirm flow instead of browser confirm', async () => {
    render(
      <WorldDatapacksModal
        isOpen={true}
        onClose={vi.fn()}
        instancePath="/instances/alpha"
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
      expect(deleteMock).toHaveBeenCalledWith('/instances/alpha', 'world-1', 'better-mobs.zip');
    });
  });

  it('installs a searched datapack through the typed IPC seam and returns to installed content', async () => {
    render(
      <WorldDatapacksModal
        isOpen={true}
        onClose={vi.fn()}
        instancePath="/instances/alpha"
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
      expect(installMock).toHaveBeenCalledWith('/instances/alpha', 'world-1', 'version-1');
    });

    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledWith('Installed datapack "Dungeon Boost"');
    });
  });
});
