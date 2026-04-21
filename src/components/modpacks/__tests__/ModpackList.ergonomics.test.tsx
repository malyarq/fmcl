// @vitest-environment jsdom

import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ModpackList } from '../ModpackList';
import { createTranslator } from '../../../contexts/settings/i18n';
import { APP_ICON_PATH } from '../../../app/assets/branding';

const listWithMetadataMock = vi.fn();
const getModrinthVersionsMock = vi.fn();
const getCurseForgeVersionsMock = vi.fn();
const selectMock = vi.fn();
const refreshMock = vi.fn();
const t = createTranslator('en');

vi.mock('../../../contexts/ModpackContext', () => ({
  useModpackListContext: () => ({
    modpacks: [{ id: 'alpha', name: 'Alpha Pack' }],
    selectedId: '',
    select: (...args: unknown[]) => selectMock(...args),
    remove: vi.fn(),
    rename: vi.fn(),
    duplicate: vi.fn(),
    refresh: (...args: unknown[]) => refreshMock(...args),
  }),
}));

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
    listWithMetadata: (...args: unknown[]) => listWithMetadataMock(...args),
    getModrinthVersions: (...args: unknown[]) => getModrinthVersionsMock(...args),
    getCurseForgeVersions: (...args: unknown[]) => getCurseForgeVersionsMock(...args),
  },
}));

vi.mock('../../../features/share/ShareModal', () => ({
  ShareModal: () => null,
}));

vi.mock('../../../features/share/ImportShareModal', () => ({
  ImportShareModal: () => null,
}));

describe('ModpackList ergonomics', () => {
  beforeEach(() => {
    cleanup();
    listWithMetadataMock.mockReset();
    getModrinthVersionsMock.mockReset();
    getCurseForgeVersionsMock.mockReset();
    selectMock.mockReset();
    refreshMock.mockReset();

    selectMock.mockResolvedValue(undefined);
    refreshMock.mockResolvedValue(undefined);
    getModrinthVersionsMock.mockResolvedValue([]);
    getCurseForgeVersionsMock.mockResolvedValue([]);
    listWithMetadataMock.mockResolvedValue([
      {
        id: 'alpha',
        name: 'Alpha Pack',
        path: '/packs/alpha',
        selected: false,
        metadata: {
          description: 'Route truth test pack',
          version: '1.2.0',
          minecraftVersion: '1.20.1',
          modLoader: { type: 'fabric' },
          updatedAt: '2026-04-12T12:00:00.000Z',
        },
      },
    ]);
  });

  it('keeps installed catalog controls grouped and card metadata labeled at sidebar widths', async () => {
    render(<ModpackList />);

    await screen.findByText('Alpha Pack');

    const searchRegion = screen.getByRole('search', { name: 'Search modpacks' });
    const controlsGrid = within(searchRegion).getByTestId('installed-modpack-filter-controls');
    const card = screen.getByRole('button', { name: 'Open details: Alpha Pack' }).closest('[role="listitem"]');

    expect(card).not.toBeNull();
    expect(searchRegion.getAttribute('data-catalog-controls')).toBe('shared');
    expect(controlsGrid.getAttribute('data-catalog-controls-layout')).toBe('compact-shared');
    expect(controlsGrid.className).toContain('lg:flex-row');
    expect(within(searchRegion).getByText('Search modpacks')).toBeTruthy();
    expect(within(searchRegion).getByText('Minecraft Version')).toBeTruthy();
    expect(within(searchRegion).getByText('Modloader')).toBeTruthy();
    expect(screen.getByTestId('installed-modpack-actions-alpha').className).toContain('grid');
    expect(screen.getByRole('button', { name: 'Make active: Alpha Pack' })).toBeTruthy();

    const cardScope = within(card as HTMLElement);
    expect(cardScope.getByText('Minecraft Version')).toBeTruthy();
    expect(cardScope.getByText('Updated')).toBeTruthy();
    expect(cardScope.queryByText('Version')).toBeNull();
    expect(cardScope.queryByText('Modloader')).toBeNull();

    await waitFor(() => {
      expect(screen.getByRole('img', { name: 'Alpha Pack' }).getAttribute('src')).toBe(APP_ICON_PATH);
    });
  });

  it('surfaces available updates on the modpack card instead of a global shell banner', async () => {
    listWithMetadataMock.mockResolvedValue([
      {
        id: 'alpha',
        name: 'Alpha Pack',
        path: '/packs/alpha',
        selected: false,
        metadata: {
          description: 'Route truth test pack',
          version: '1.2.0',
          source: 'modrinth',
          sourceId: 'alpha-pack',
          sourceVersionId: 'release-1',
          minecraftVersion: '1.20.1',
          modLoader: { type: 'fabric' },
        },
      },
    ]);
    getModrinthVersionsMock.mockResolvedValue([
      {
        platform: 'modrinth',
        versionId: 'release-2',
        name: '1.3.0',
        versionNumber: '1.3.0',
        mcVersions: ['1.20.1'],
        loaders: ['fabric'],
        files: [],
      },
    ]);

    render(<ModpackList />);

    await screen.findByRole('button', { name: 'Open details: Alpha Pack' });

    await waitFor(() => {
      expect(screen.getByTestId('installed-modpack-update-indicator-alpha')).toBeTruthy();
    });

    const updateIndicator = screen.getByTestId('installed-modpack-update-indicator-alpha');
    expect(updateIndicator.getAttribute('data-update-scope')).toBe('modpack-local');
    expect(updateIndicator.className).not.toContain('uppercase');
    expect(updateIndicator.textContent).toContain('Update available');
    expect(screen.queryByTestId('app-update-notification')).toBeNull();
  });
});
