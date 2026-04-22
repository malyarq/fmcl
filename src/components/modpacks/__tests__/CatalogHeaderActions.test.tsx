// @vitest-environment jsdom

import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ModpackList } from '../ModpackList';
import { ModpackBrowser } from '../ModpackBrowser';
import { createTranslator } from '../../../contexts/settings/i18n';
import { DEFAULT_MODPACK_BROWSER_STATE } from '../../../features/modpacks/hooks/useModpackNavigation';

const listWithMetadataMock = vi.fn();
const searchModrinthMock = vi.fn();
const getCurseForgeVersionsMock = vi.fn();
const getModrinthVersionsMock = vi.fn();
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
    formatDate: (timestamp: number | undefined, unknownText = 'Unknown', options?: Intl.DateTimeFormatOptions) =>
      timestamp ? new Date(timestamp).toLocaleDateString('en-US', options) : unknownText,
    formatNumber: (value: number, options?: Intl.NumberFormatOptions) => new Intl.NumberFormat('en-US', options).format(value),
    minecraftPath: '/minecraft',
  }),
}));

vi.mock('../../../hooks/useDebounce', () => ({
  useDebounce: <T,>(value: T) => value,
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
    searchModrinth: (...args: unknown[]) => searchModrinthMock(...args),
    getCurseForgeVersions: (...args: unknown[]) => getCurseForgeVersionsMock(...args),
    getModrinthVersions: (...args: unknown[]) => getModrinthVersionsMock(...args),
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

describe('Catalog header actions', () => {
  beforeEach(() => {
    cleanup();
    localStorage.clear();
    listWithMetadataMock.mockReset();
    searchModrinthMock.mockReset();
    getCurseForgeVersionsMock.mockReset();
    getModrinthVersionsMock.mockReset();
    selectMock.mockReset();
    refreshMock.mockReset();

    selectMock.mockResolvedValue(undefined);
    refreshMock.mockResolvedValue(undefined);
    getCurseForgeVersionsMock.mockResolvedValue([]);
    getModrinthVersionsMock.mockResolvedValue([]);

    listWithMetadataMock.mockResolvedValue([
      {
        id: 'alpha',
        name: 'Alpha Pack',
        path: '/packs/alpha',
        selected: false,
        metadata: {
          minecraftVersion: '1.20.1',
          modLoader: { type: 'fabric' },
          updatedAt: '2026-04-12T12:00:00.000Z',
        },
      },
    ]);

    searchModrinthMock.mockResolvedValue({
      items: [
        {
          platform: 'modrinth',
          projectId: 'alpha-pack',
          title: 'Alpha Pack',
          minecraftVersion: '1.20.1',
          dateModified: '2026-04-11T10:00:00.000Z',
        },
      ],
      total: 1,
      offset: 0,
      limit: 12,
    });
  });

  it('keeps installed header CTAs and card actions on the shared catalog-primary geometry seam', async () => {
    render(<ModpackList />);

    await screen.findByRole('button', { name: 'Open details: Alpha Pack' });

    const headerCluster = screen.getByTestId('installed-modpack-primary-actions');
    const headerButtons = within(headerCluster).getAllByRole('button');
    const cardButtons = within(screen.getByTestId('installed-modpack-actions-alpha')).getAllByRole('button');

    [...headerButtons, ...cardButtons].forEach((button) => {
      expect(button.getAttribute('data-button-geometry')).toBe('catalog-primary');
      expect(button.className).toContain('min-h-10');
      expect(button.className).toContain('whitespace-normal');
    });
  });

  it('keeps browser header CTAs and primary card actions on the shared catalog-primary geometry seam', async () => {
    render(
      <ModpackBrowser
        initialState={{ ...DEFAULT_MODPACK_BROWSER_STATE, platform: 'modrinth' }}
        onBack={vi.fn()}
        onNavigate={vi.fn()}
        onStateChange={vi.fn()}
      />
    );

    await screen.findByRole('button', { name: 'Open details: Alpha Pack' });

    const headerCluster = screen.getByTestId('remote-modpack-primary-actions');
    const headerButtons = within(headerCluster).getAllByRole('button');
    const cardButton = screen.getByRole('button', { name: 'Open details: Alpha Pack' });

    [...headerButtons, cardButton].forEach((button) => {
      expect(button.getAttribute('data-button-geometry')).toBe('catalog-primary');
      expect(button.className).toContain('min-h-10');
      expect(button.className).toContain('px-4');
      expect(button.className).toContain('whitespace-normal');
    });

    await waitFor(() => {
      expect(cardButton.querySelector('svg')).not.toBeNull();
    });
  });
});
