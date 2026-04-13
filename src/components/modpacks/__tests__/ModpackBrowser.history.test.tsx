// @vitest-environment jsdom

import type { ComponentProps } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ModpackSearchResultItem } from '@shared/contracts/modpacks';
import { ModpackBrowser } from '../ModpackBrowser';
import { DEFAULT_MODPACK_BROWSER_STATE } from '../../../features/modpacks/hooks/useModpackNavigation';
import { createTranslator } from '../../../contexts/settings/i18n';

const searchModrinthMock = vi.fn();
const getCurseForgeVersionsMock = vi.fn();
const getModrinthVersionsMock = vi.fn();
const t = createTranslator('en');

vi.mock('../../../contexts/SettingsContext', () => ({
  useSettings: () => ({
    t,
    getAccentStyles: () => ({ className: '', style: undefined }),
  }),
}));

vi.mock('../../../hooks/useDebounce', () => ({
  useDebounce: <T,>(value: T) => value,
}));

vi.mock('../../../services/ipc/modpacksIPC', () => ({
  modpacksIPC: {
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

function seedHistory(modpacks: ModpackSearchResultItem[]) {
  localStorage.setItem('modpack-history', JSON.stringify(modpacks));
}

describe('ModpackBrowser history flow', () => {
  beforeEach(() => {
    cleanup();
    localStorage.clear();
    searchModrinthMock.mockReset();
    getCurseForgeVersionsMock.mockReset();
    getModrinthVersionsMock.mockReset();

    searchModrinthMock.mockResolvedValue({
      items: [],
      total: 0,
      offset: 0,
      limit: 12,
    });
    getCurseForgeVersionsMock.mockResolvedValue([]);
    getModrinthVersionsMock.mockResolvedValue([]);
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
      expect(getCurseForgeVersionsMock).toHaveBeenCalledWith(42);
    });
    expect(getModrinthVersionsMock).not.toHaveBeenCalled();
    expect(onNavigate).toHaveBeenCalledWith(expect.objectContaining({
      type: 'install',
      platform: 'curseforge',
      modpack: expect.objectContaining({ title: 'CurseForge Pack', platform: 'curseforge' }),
    }));

    const savedHistory = JSON.parse(localStorage.getItem('modpack-history') ?? '[]') as ModpackSearchResultItem[];
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
