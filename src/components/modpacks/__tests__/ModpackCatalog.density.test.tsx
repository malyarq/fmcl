// @vitest-environment jsdom

import type { ComponentProps } from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProviderCatalogAPI } from '@shared/contracts';
import { ModpackBrowser } from '../ModpackBrowser';
import { ModpackList } from '../ModpackList';
import { DEFAULT_MODPACK_BROWSER_STATE } from '../../../features/modpacks/hooks/useModpackNavigation';
import { instancesFromListFixture } from './instancesListFixture';
import { createTranslator } from '../../../contexts/settings/i18n';

const searchMock = vi.fn<ProviderCatalogAPI['search']>();
const versionsMock = vi.fn<ProviderCatalogAPI['versions']>();
const listWithMetadataMock = vi.fn();
const selectMock = vi.fn();
const refreshMock = vi.fn();
const t = createTranslator('en');
let selectedIdState = 'beta';

vi.mock('../../../contexts/SettingsContext', () => ({
  useSettings: () => ({
    t,
    getAccentStyles: () => ({ className: '', style: undefined }),
    getAccentHex: () => '#10b981',
    formatDate: (timestamp: number | undefined, unknownText = 'Unknown', options?: Intl.DateTimeFormatOptions) =>
      timestamp ? new Date(timestamp).toLocaleDateString('en-US', options) : unknownText,
    formatNumber: (value: number, options?: Intl.NumberFormatOptions) => new Intl.NumberFormat('en-US', options).format(value),
    minecraftPath: '/minecraft',
  }),
}));

vi.mock('../../../hooks/useDebounce', () => ({
  useDebounce: <T,>(value: T) => value,
}));

vi.mock('../../../features/instances/hooks/useInstanceSelectors', () => ({
  useInstanceList: () => ({
    status: 'ready',
    data: [
      { id: 'alpha', name: 'Dense Alpha Pack for Fourteen Players and Three Runtime Profiles', selected: false, summary: { minecraftVersion: '1.20.1', modLoader: { type: 'fabric' } } },
      { id: 'beta', name: 'Secondary Archive Pack with Old Save Compatibility', selected: true, summary: { minecraftVersion: '1.20.1', modLoader: { type: 'fabric' } } },
    ],
  }),
  useSelectedInstanceId: () => ({ status: 'ready', data: selectedIdState }),
}));

vi.mock('../../../features/instances/hooks/useInstanceInvalidation', () => ({
  useInstanceInvalidation: () => ({
    invalidateInstance: vi.fn(),
    invalidateInstances: (...args: unknown[]) => refreshMock(...args),
  }),
}));

vi.mock('../../../contexts/instances/hooks/useInstanceCrudActions', () => ({
  useInstanceCrudActions: () => ({
    select: (...args: unknown[]) => selectMock(...args),
    remove: vi.fn(),
    rename: vi.fn(),
    duplicate: vi.fn(),
  }),
}));

vi.mock('../../../contexts/ToastContext', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  }),
}));

vi.mock('../../../contexts/ConfirmContext', () => ({
  useConfirm: () => ({
    confirm: vi.fn(),
    prompt: vi.fn(),
  }),
}));

vi.mock('../../../services/ipc/providerCatalogIPC', () => ({
  providerCatalogIPC: {
    search: (...args: Parameters<ProviderCatalogAPI['search']>) => searchMock(...args),
    versions: (...args: Parameters<ProviderCatalogAPI['versions']>) => versionsMock(...args),
  },
}));

vi.mock('../../../services/ipc/dialogIPC', () => ({
  dialogIPC: {
    showOpenDialog: vi.fn(),
  },
}));

vi.mock('../../../features/share/ShareModal', () => ({
  ShareModal: () => null,
}));

vi.mock('../../../features/share/ImportShareModal', () => ({
  ImportShareModal: () => null,
}));

function renderBrowser(overrides: Partial<ComponentProps<typeof ModpackBrowser>> = {}) {
  render(
    <ModpackBrowser
      initialState={{ ...DEFAULT_MODPACK_BROWSER_STATE, platform: 'modrinth', ...overrides.initialState }}
      onBack={vi.fn()}
      onNavigate={vi.fn()}
      onStateChange={vi.fn()}
    />
  );
}

describe('Modpack catalog density', () => {
  const denseBrowserTitle = 'The Unreasonably Long Modrinth Pack Title That Used To Push Metadata Into Ambiguous Rows';
  const denseInstalledTitle = 'Dense Alpha Pack for Fourteen Players and Three Runtime Profiles';

  beforeEach(() => {
    Object.defineProperty(window, 'api', { configurable: true, value: { instances: instancesFromListFixture(() => listWithMetadataMock()) } });
    cleanup();
    localStorage.clear();
    selectedIdState = 'beta';
    searchMock.mockReset();
    versionsMock.mockReset();
    listWithMetadataMock.mockReset();
    selectMock.mockReset();
    refreshMock.mockReset();

    searchMock.mockResolvedValue({
      items: [
        {
          platform: 'modrinth',
          projectId: 'alpha-remote',
          title: denseBrowserTitle,
          description: 'Long-form pack summary with enough detail to stress the catalog card and footer layout.',
          minecraftVersion: '1.20.1',
          downloads: 148600,
          dateModified: '2026-04-11T10:00:00.000Z',
        },
        {
          platform: 'modrinth',
          projectId: 'beta-remote',
          title: 'Secondary Pack with Dependency Warnings and Server Notes',
          description: 'Another crowded result to keep the results grid under pressure.',
          minecraftVersion: '1.20.1',
          downloads: 84200,
          dateModified: '2026-04-10T08:30:00.000Z',
        },
      ],
      total: 2,
      offset: 0,
      limit: 12,
    });
    versionsMock.mockResolvedValue([]);
    selectMock.mockResolvedValue(undefined);
    refreshMock.mockResolvedValue(undefined);
    listWithMetadataMock.mockResolvedValue([
      {
        id: 'alpha',
        name: denseInstalledTitle,
        path: '/packs/alpha',
        selected: false,
        metadata: {
          description: 'Installed pack summary with enough words to compete with metadata tiles and action buttons.',
          version: '2.4.19',
          minecraftVersion: '1.20.1',
          modLoader: { type: 'fabric' },
          updatedAt: '2026-04-12T12:00:00.000Z',
          source: 'modrinth',
        },
      },
      {
        id: 'beta',
        name: 'Secondary Archive Pack with Old Save Compatibility',
        path: '/packs/beta',
        selected: true,
        metadata: {
          description: 'Archive-focused pack for active summary proof.',
          version: '1.8.3',
          minecraftVersion: '1.20.1',
          modLoader: { type: 'fabric' },
          updatedAt: '2026-04-10T09:15:00.000Z',
          source: 'curseforge',
        },
      },
    ]);
  });

  it('keeps browser summary tokens and crowded cards explicitly labeled', async () => {
    renderBrowser({
      initialState: {
        ...DEFAULT_MODPACK_BROWSER_STATE,
        platform: 'modrinth',
        query: 'dense',
        sortBy: 'alphabetical',
        filterMCVersion: '1.20.1',
        filterLoader: 'fabric',
      },
    });

    await screen.findByText(denseBrowserTitle);

    const searchRegion = screen.getByTestId('remote-modpack-filters');
    expect(searchRegion.getAttribute('data-catalog-controls')).toBe('shared');
    expect(screen.queryByTestId('remote-modpack-summary')).toBeNull();
    expect(within(searchRegion).getByText('Search modpacks: "dense"')).toBeTruthy();
    expect(within(searchRegion).getByText('Minecraft Version: 1.20.1')).toBeTruthy();
    expect(within(searchRegion).getByText('Modloader: Fabric')).toBeTruthy();

    const card = screen
      .getByRole('button', { name: `Open details: ${denseBrowserTitle}` })
      .closest('[role="listitem"]');

    expect(card).not.toBeNull();
    expect(within(card as HTMLElement).getByText('Minecraft Version')).toBeTruthy();
    expect(within(card as HTMLElement).getByText('1.20.1')).toBeTruthy();
    expect(within(card as HTMLElement).getByText('Updated')).toBeTruthy();
    expect(within(card as HTMLElement).queryByText('Modrinth')).toBeNull();
    expect(within(card as HTMLElement).queryByText('Downloads')).toBeNull();
    expect(screen.queryByText('Long-form pack summary with enough detail to stress the catalog card and footer layout.')).toBeNull();
  });

  it('keeps installed summaries, metadata blocks, and action ownership readable under dense filters', async () => {
    render(<ModpackList />);

    await screen.findByText(denseInstalledTitle);

    fireEvent.change(screen.getByRole('textbox', { name: 'Enter modpack name...' }), { target: { value: 'Dense' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'All versions' }), { target: { value: '1.20.1' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'All Modloaders' }), { target: { value: 'fabric' } });

    await waitFor(() => {
      const controls = screen.getByTestId('installed-modpack-filters');
      expect(within(controls).getByText('Search modpacks: "Dense"')).toBeTruthy();
    });

    const controls = screen.getByTestId('installed-modpack-filters');
    expect(controls.getAttribute('data-catalog-controls')).toBe('shared');
    expect(screen.queryByTestId('installed-modpack-summary')).toBeNull();
    expect(within(controls).getByText('Minecraft Version: 1.20.1')).toBeTruthy();
    expect(within(controls).getByText('Modloader: Fabric')).toBeTruthy();
    expect(within(controls).queryByText(/^Active:/i)).toBeNull();

    const actionShell = screen.getByTestId('installed-modpack-actions-alpha');
    const card = screen
      .getByRole('button', { name: `Open details: ${denseInstalledTitle}` })
      .closest('[role="listitem"]');

    expect(actionShell.className).toContain('grid');
    expect(within(actionShell).getByRole('button', { name: `Make active: ${denseInstalledTitle}` })).toBeTruthy();
    expect(within(actionShell).getByRole('button', { name: `Open details: ${denseInstalledTitle}` }).className).toContain('col-span-2');
    expect(card).not.toBeNull();
    expect(within(card as HTMLElement).getByText('Minecraft Version')).toBeTruthy();
    expect(within(card as HTMLElement).getByText('Updated')).toBeTruthy();
    expect(within(card as HTMLElement).queryByText('CurseForge')).toBeNull();
    expect(within(card as HTMLElement).queryByText('Modrinth')).toBeNull();
    expect(within(card as HTMLElement).queryByText('Version')).toBeNull();
    expect(within(card as HTMLElement).queryByText('Modloader')).toBeNull();
    expect(screen.queryByText('Installed pack summary with enough words to compete with metadata tiles and action buttons.')).toBeNull();
  });
});
