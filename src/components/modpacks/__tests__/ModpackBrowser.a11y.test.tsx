// @vitest-environment jsdom

import type { ComponentProps } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProviderCatalogAPI } from '@shared/contracts';
import { ModpackBrowser } from '../ModpackBrowser';
import { DEFAULT_MODPACK_BROWSER_STATE } from '../../../features/modpacks/hooks/useModpackNavigation';
import { createTranslator } from '../../../contexts/settings/i18n';

const searchMock = vi.fn<ProviderCatalogAPI['search']>();
const versionsMock = vi.fn<ProviderCatalogAPI['versions']>();
const t = createTranslator('en');

vi.mock('../../../contexts/SettingsContext', () => ({
  useSettings: () => ({
    t,
    getAccentStyles: () => ({ className: '', style: undefined }),
    formatDate: (timestamp: number | undefined, unknownText = 'Unknown', options?: Intl.DateTimeFormatOptions) =>
      timestamp ? new Date(timestamp).toLocaleDateString('en-US', options) : unknownText,
    formatNumber: (value: number, options?: Intl.NumberFormatOptions) => new Intl.NumberFormat('en-US', options).format(value),
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

function renderBrowser(overrides: Partial<ComponentProps<typeof ModpackBrowser>> = {}) {
  const onNavigate = vi.fn();

  render(
    <ModpackBrowser
      initialState={{ ...DEFAULT_MODPACK_BROWSER_STATE, platform: 'modrinth', ...overrides.initialState }}
      onBack={vi.fn()}
      onNavigate={onNavigate}
      onStateChange={vi.fn()}
    />
  );

  return { onNavigate };
}

describe('ModpackBrowser accessibility', () => {
  beforeEach(() => {
    cleanup();
    localStorage.clear();
    searchMock.mockReset();
    versionsMock.mockReset();

    searchMock.mockResolvedValue({
      items: [
        {
          platform: 'modrinth',
          projectId: 'alpha-pack',
          title: 'Alpha Pack',
          description: 'Fast keyboard test pack',
          downloads: 1337,
        },
      ],
      total: 1,
      offset: 0,
      limit: 12,
    });
    versionsMock.mockResolvedValue([]);
  });

  it('exposes accessible search, favorite, and result activation controls', async () => {
    const { onNavigate } = renderBrowser();

    await screen.findByRole('search', { name: t('modpacks.search') || 'Search modpacks' });
    await screen.findByRole('textbox', { name: t('modpacks.search_placeholder') || 'Enter modpack name...' });

    const resultButton = await screen.findByRole('button', { name: 'Alpha Pack' });
    const favoriteButton = screen.getByRole('button', { name: 'Add to favorites: Alpha Pack' });
    screen.getByRole('button', { name: 'History' });
    expect(favoriteButton.getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(favoriteButton);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Remove from favorites: Alpha Pack' }).getAttribute('aria-pressed')).toBe('true');
    });

    fireEvent.keyDown(resultButton, { key: 'Enter' });

    await waitFor(() => {
      expect(versionsMock).toHaveBeenCalledWith({ platform: 'modrinth', projectId: 'alpha-pack' });
    });
    expect(onNavigate).toHaveBeenCalledWith(expect.objectContaining({
      type: 'install',
      modpack: expect.objectContaining({ title: 'Alpha Pack' }),
    }));
  });
});
