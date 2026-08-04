// @vitest-environment jsdom

import type { ComponentProps } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProviderCatalogAPI } from '@shared/contracts';
import { createTranslator } from '../../../contexts/settings/i18n';
import { instancesFromListFixture } from './instancesListFixture';
import { DEFAULT_MODPACK_BROWSER_STATE } from '../../../features/modpacks/hooks/useModpackNavigation';
import { ModpackBrowser } from '../ModpackBrowser';
import { ModpackList } from '../ModpackList';

const t = createTranslator('en');
const searchMock = vi.fn<ProviderCatalogAPI['search']>();
const versionsMock = vi.fn<ProviderCatalogAPI['versions']>();
const listWithMetadataMock = vi.fn();
const selectMock = vi.fn();
const refreshMock = vi.fn();
let selectedIdState = 'alpha';

function getAccentStyles(type: string) {
  switch (type) {
    case 'bg':
      return { className: 'state-bg-token', style: undefined };
    case 'soft-bg':
      return { className: 'state-soft-bg-token', style: undefined };
    case 'soft-border':
      return { className: 'state-soft-border-token', style: undefined };
    case 'title':
      return { className: 'state-title-token', style: undefined };
    case 'accent':
      return { className: 'state-accent-token', style: undefined };
    default:
      return { className: '', style: undefined };
  }
}

vi.mock('../../../contexts/SettingsContext', () => ({
  useSettings: () => ({
    t,
    getAccentStyles,
    formatDate: (timestamp: number | undefined, unknownText = 'Unknown', options?: Intl.DateTimeFormatOptions) =>
      timestamp ? new Date(timestamp).toLocaleDateString('en-US', options) : unknownText,
    formatNumber: (value: number, options?: Intl.NumberFormatOptions) => new Intl.NumberFormat('en-US', options).format(value),
    minecraftPath: '/minecraft',
  }),
}));

vi.mock('../../../contexts/ModpackContext', () => ({
  useModpackListContext: () => ({
    modpacks: [
      { id: 'alpha', name: 'Alpha Pack' },
      { id: 'beta', name: 'Beta Pack' },
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

vi.mock('../../../hooks/useDebounce', () => ({
  useDebounce: <T,>(value: T) => value,
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

describe('Modpack route theme state', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'api', { configurable: true, value: { instances: instancesFromListFixture(() => listWithMetadataMock()) } });
    cleanup();
    localStorage.clear();
    selectedIdState = 'alpha';
    searchMock.mockReset();
    versionsMock.mockReset();
    listWithMetadataMock.mockReset();
    selectMock.mockReset();
    refreshMock.mockReset();

    searchMock.mockResolvedValue({
      items: [
        {
          platform: 'modrinth',
          projectId: 'alpha-pack',
          title: 'Alpha Pack',
          description: 'Accent-backed browser result.',
          downloads: 1200,
          dateModified: '2026-04-11T10:00:00.000Z',
        },
      ],
      total: 1,
      offset: 0,
      limit: 12,
    });
    versionsMock.mockResolvedValue([]);
    listWithMetadataMock.mockResolvedValue([
      {
        id: 'alpha',
        name: 'Alpha Pack',
        path: '/packs/alpha',
        selected: true,
        metadata: {
          description: 'Selected pack',
          minecraftVersion: '1.20.1',
          modLoader: { type: 'fabric' },
          updatedAt: '2026-04-12T00:00:00.000Z',
        },
      },
      {
        id: 'beta',
        name: 'Beta Pack',
        path: '/packs/beta',
        selected: false,
        metadata: {
          description: 'Inactive pack',
          minecraftVersion: '1.19.4',
          modLoader: { type: 'forge' },
          updatedAt: '2026-04-10T00:00:00.000Z',
        },
      },
    ]);
    selectMock.mockResolvedValue(undefined);
    refreshMock.mockResolvedValue(undefined);
  });

  it('applies shared active-state tokens to browser favorites', async () => {
    renderBrowser();

    const favoriteButton = await screen.findByRole('button', { name: 'Add to favorites: Alpha Pack' });
    fireEvent.click(favoriteButton);

    const activeFavoriteButton = await screen.findByRole('button', { name: 'Remove from favorites: Alpha Pack' });
    expect(activeFavoriteButton.getAttribute('data-state')).toBe('active');
    expect(activeFavoriteButton.className).toContain('state-soft-bg-token');
    expect(activeFavoriteButton.className).toContain('state-soft-border-token');
    expect(activeFavoriteButton.querySelector('svg')?.getAttribute('class')).toContain('state-title-token');
  });

  it('marks the selected installed modpack with the shared active surface contract', async () => {
    render(<ModpackList />);

    const activeCard = (await screen.findByRole('button', { name: 'Alpha Pack' })).closest('[data-state="active"]');
    const inactiveCard = screen.getByRole('button', { name: 'Beta Pack' }).closest('[data-state="inactive"]');

    expect(activeCard).toBeTruthy();
    expect(activeCard?.className).toContain('state-soft-bg-token');
    expect(activeCard?.className).toContain('state-soft-border-token');
    expect(activeCard?.querySelector('.state-title-token')?.textContent).toBe('Active');
    expect(inactiveCard).toBeTruthy();
    expect(inactiveCard?.className).not.toContain('state-soft-bg-token');
  });
});
