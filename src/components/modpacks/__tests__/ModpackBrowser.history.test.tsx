// @vitest-environment jsdom

import type { ComponentProps } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProviderCatalogAPI } from '@shared/contracts';
import type { ProviderCatalogSearchResultItem } from '@shared/contracts/providerCatalog';
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
  const onStateChange = vi.fn();

  render(
    <ModpackBrowser
      initialState={{ ...DEFAULT_MODPACK_BROWSER_STATE, platform: 'modrinth', ...overrides.initialState }}
      onBack={vi.fn()}
      onNavigate={onNavigate}
      onStateChange={onStateChange}
    />
  );

  return { onNavigate, onStateChange };
}

function seedHistory(modpacks: ProviderCatalogSearchResultItem[]) {
  localStorage.setItem('modpack-history', JSON.stringify(modpacks));
}

describe('ModpackBrowser history flow', () => {
  beforeEach(() => {
    cleanup();
    localStorage.clear();
    searchMock.mockReset();
    versionsMock.mockReset();

    searchMock.mockResolvedValue({
      items: [],
      total: 0,
      offset: 0,
      limit: 12,
    });
    versionsMock.mockResolvedValue([]);
  });

  it('reopens history entries with their own provider and preserves mixed-provider history entries', async () => {
    seedHistory([
      {
        platform: 'modrinth',
        projectId: '42',
        title: 'Modrinth Pack',
      },
      {
        platform: 'curseforge',
        projectId: '42',
        title: 'CurseForge Pack',
      },
    ]);

    const { onNavigate, onStateChange } = renderBrowser({
      initialState: {
        ...DEFAULT_MODPACK_BROWSER_STATE,
        platform: 'modrinth',
        showHistory: true,
      },
    });

    await screen.findByText('CurseForge Pack');
    await waitFor(() => {
      expect(onStateChange).toHaveBeenCalledWith(expect.objectContaining({ showHistory: true }));
    });

    fireEvent.click(screen.getByText('CurseForge Pack'));

    await waitFor(() => {
      expect(versionsMock).toHaveBeenCalledWith({ platform: 'curseforge', projectId: '42' });
    });
    expect(versionsMock).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledWith(expect.objectContaining({
      type: 'install',
      platform: 'curseforge',
      modpack: expect.objectContaining({ title: 'CurseForge Pack', platform: 'curseforge' }),
    }));

    const savedHistory = JSON.parse(localStorage.getItem('modpack-history') ?? '[]') as ProviderCatalogSearchResultItem[];
    expect(savedHistory).toHaveLength(2);
    expect(savedHistory.map((modpack) => `${modpack.platform}:${modpack.projectId}`)).toEqual([
      'curseforge:42',
      'modrinth:42',
    ]);
  });

  it('keeps favorites isolated by provider identity inside history view', async () => {
    seedHistory([
      {
        platform: 'modrinth',
        projectId: '42',
        title: 'Modrinth Pack',
      },
      {
        platform: 'curseforge',
        projectId: '42',
        title: 'CurseForge Pack',
      },
    ]);

    renderBrowser({
      initialState: {
        ...DEFAULT_MODPACK_BROWSER_STATE,
        platform: 'modrinth',
        showHistory: true,
      },
    });

    await screen.findByText('Modrinth Pack');
    const favoriteButtons = screen.getAllByTitle('Add to favorites');

    fireEvent.click(favoriteButtons[0]);

    await waitFor(() => {
      expect(screen.getByTitle('Remove from favorites')).toBeTruthy();
    });
    expect(screen.getByTitle('Add to favorites')).toBeTruthy();
    expect(JSON.parse(localStorage.getItem('modpack-favorites') ?? '[]')).toEqual(['modrinth:42']);
  });
});
