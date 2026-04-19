// @vitest-environment jsdom

import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ModpackList } from '../ModpackList';
import { createTranslator } from '../../../contexts/settings/i18n';
import { MEDIA_FALLBACK_PATH } from '../../../app/assets/branding';

const listWithMetadataMock = vi.fn();
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
    selectMock.mockReset();
    refreshMock.mockReset();

    selectMock.mockResolvedValue(undefined);
    refreshMock.mockResolvedValue(undefined);
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
    expect(controlsGrid.className).toContain('grid');
    expect(controlsGrid.className).toContain('xl:grid-cols-4');
    expect(within(searchRegion).getByText('Search modpacks')).toBeTruthy();
    expect(within(searchRegion).getByText('Minecraft Version')).toBeTruthy();
    expect(within(searchRegion).getByText('Modloader')).toBeTruthy();
    expect(screen.getByTestId('installed-modpack-actions-alpha').className).toContain('grid');
    expect(screen.getByRole('button', { name: 'Make active: Alpha Pack' })).toBeTruthy();

    const cardScope = within(card as HTMLElement);
    expect(cardScope.getByText('Version')).toBeTruthy();
    expect(cardScope.getByText('Minecraft Version')).toBeTruthy();
    expect(cardScope.getByText('Modloader')).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByRole('img', { name: 'Alpha Pack' }).getAttribute('src')).toBe(MEDIA_FALLBACK_PATH);
    });
  });
});
