// @vitest-environment jsdom

import type { ComponentProps } from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ModpackBrowser } from '../ModpackBrowser';
import { ModpackList } from '../ModpackList';
import { DEFAULT_MODPACK_BROWSER_STATE } from '../../../features/modpacks/hooks/useModpackNavigation';
import { createTranslator } from '../../../contexts/settings/i18n';

const searchModrinthMock = vi.fn();
const getCurseForgeVersionsMock = vi.fn();
const getModrinthVersionsMock = vi.fn();
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

vi.mock('../../../contexts/ModpackContext', () => ({
  useModpackListContext: () => ({
    modpacks: [
      { id: 'alpha', name: 'Dense Alpha Pack' },
      { id: 'beta', name: 'Secondary Archive Pack with Old Save Compatibility' },
    ],
    selectedId: selectedIdState,
    select: (...args: unknown[]) => selectMock(...args),
    remove: vi.fn(),
    rename: vi.fn(),
    duplicate: vi.fn(),
    refresh: (...args: unknown[]) => refreshMock(...args),
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

vi.mock('../../../services/ipc/modpacksIPC', () => ({
  modpacksIPC: {
    searchModrinth: (...args: unknown[]) => searchModrinthMock(...args),
    getCurseForgeVersions: (...args: unknown[]) => getCurseForgeVersionsMock(...args),
    getModrinthVersions: (...args: unknown[]) => getModrinthVersionsMock(...args),
    listWithMetadata: (...args: unknown[]) => listWithMetadataMock(...args),
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
    cleanup();
    localStorage.clear();
    selectedIdState = 'beta';
    searchModrinthMock.mockReset();
    getCurseForgeVersionsMock.mockReset();
    getModrinthVersionsMock.mockReset();
    listWithMetadataMock.mockReset();
    selectMock.mockReset();
    refreshMock.mockReset();

    searchModrinthMock.mockResolvedValue({
      items: [
        {
          platform: 'modrinth',
          projectId: 'alpha-remote',
          title: denseBrowserTitle,
          description: 'Long-form pack summary with enough detail to stress the catalog card and footer layout.',
          downloads: 148600,
          dateModified: '2026-04-11T10:00:00.000Z',
        },
        {
          platform: 'modrinth',
          projectId: 'beta-remote',
          title: 'Secondary Pack with Dependency Warnings and Server Notes',
          description: 'Another crowded result to keep the results grid under pressure.',
          downloads: 84200,
          dateModified: '2026-04-10T08:30:00.000Z',
        },
      ],
      total: 2,
      offset: 0,
      limit: 12,
    });
    getCurseForgeVersionsMock.mockResolvedValue([]);
    getModrinthVersionsMock.mockResolvedValue([]);
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

    const summary = screen.getByTestId('remote-modpack-summary');
    expect(within(summary).getByText('Active filters')).toBeTruthy();
    expect(within(summary).getByText('Search modpacks: "dense"')).toBeTruthy();
    expect(within(summary).getByText('Minecraft Version: 1.20.1')).toBeTruthy();
    expect(within(summary).getByText('Modloader: Fabric')).toBeTruthy();

    const card = screen
      .getByRole('button', { name: `Open details: ${denseBrowserTitle}` })
      .closest('[role="listitem"]');

    expect(card).not.toBeNull();
    expect(within(card as HTMLElement).getByText('Downloads')).toBeTruthy();
    expect(within(card as HTMLElement).getByText('Updated')).toBeTruthy();
  });

  it('keeps installed summaries, metadata blocks, and action ownership readable under dense filters', async () => {
    render(<ModpackList />);

    await screen.findByText(denseInstalledTitle);

    fireEvent.change(screen.getByRole('textbox', { name: 'Enter modpack name...' }), { target: { value: 'Dense' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'All versions' }), { target: { value: '1.20.1' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'All Modloaders' }), { target: { value: 'fabric' } });

    await waitFor(() => {
      const summary = screen.getByTestId('installed-modpack-summary');
      expect(within(summary).getByText('Search modpacks: "Dense"')).toBeTruthy();
    });

    const summary = screen.getByTestId('installed-modpack-summary');
    expect(within(summary).getByText('Minecraft Version: 1.20.1')).toBeTruthy();
    expect(within(summary).getByText('Modloader: Fabric')).toBeTruthy();
    expect(within(summary).getByText('Secondary Archive Pack with Old Save Compatibility')).toBeTruthy();

    const actionShell = screen.getByTestId('installed-modpack-actions-alpha');
    const card = screen
      .getByRole('button', { name: `Open details: ${denseInstalledTitle}` })
      .closest('[role="listitem"]');

    expect(actionShell.className).toContain('grid');
    expect(within(actionShell).getByRole('button', { name: `Make active: ${denseInstalledTitle}` })).toBeTruthy();
    expect(within(actionShell).getByRole('button', { name: `Open details: ${denseInstalledTitle}` }).className).toContain('col-span-2');
    expect(card).not.toBeNull();
    expect(within(card as HTMLElement).getByText('Version')).toBeTruthy();
    expect(within(card as HTMLElement).getByText('Minecraft Version')).toBeTruthy();
    expect(within(card as HTMLElement).getByText('Modloader')).toBeTruthy();
  });
});
