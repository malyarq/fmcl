// @vitest-environment jsdom

import type { ComponentProps } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ModpackBrowser } from '../ModpackBrowser';
import { DEFAULT_MODPACK_BROWSER_STATE } from '../../../features/modpacks/hooks/useModpackNavigation';
import { createTranslator } from '../../../contexts/settings/i18n';
import { LAUNCHER_MARK_PATH } from '../../../app/assets/branding';

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

describe('ModpackBrowser ergonomics', () => {
  beforeEach(() => {
    cleanup();
    localStorage.clear();
    searchModrinthMock.mockReset();
    getCurseForgeVersionsMock.mockReset();
    getModrinthVersionsMock.mockReset();

    searchModrinthMock.mockResolvedValue({
      items: [
        {
          platform: 'modrinth',
          projectId: 'alpha-pack',
          title: 'Alpha Pack',
          description: 'A polished kitchen-sink pack',
          downloads: 1200,
          dateModified: '2026-04-11T10:00:00.000Z',
        },
      ],
      total: 24,
      offset: 0,
      limit: 12,
    });
    getCurseForgeVersionsMock.mockResolvedValue([]);
    getModrinthVersionsMock.mockResolvedValue([]);
  });

  it('keeps unavailable provider state honest and exposes recent recall without leaving browse mode', async () => {
    localStorage.setItem('modpack-history', JSON.stringify([
      {
        platform: 'curseforge',
        projectId: '42',
        title: 'CurseForge Pack',
      },
    ]));

    const { onNavigate, onStateChange } = renderBrowser({
      initialState: {
        ...DEFAULT_MODPACK_BROWSER_STATE,
        platform: 'curseforge',
      },
    });

    await screen.findByText('Alpha Pack');

    expect(screen.getByText('CurseForge browse unavailable')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Open recent modpack CurseForge Pack' })).toBeTruthy();

    await waitFor(() => {
      expect(onStateChange).toHaveBeenCalledWith(expect.objectContaining({ platform: 'modrinth' }));
    });

    fireEvent.click(screen.getByRole('button', { name: 'Open recent modpack CurseForge Pack' }));

    await waitFor(() => {
      expect(getCurseForgeVersionsMock).toHaveBeenCalledWith(42);
    });
    expect(onNavigate).toHaveBeenCalledWith(expect.objectContaining({
      type: 'install',
      platform: 'curseforge',
      modpack: expect.objectContaining({ title: 'CurseForge Pack' }),
    }));
  });

  it('summarizes active filters and lets users clear them back to the default browser state', async () => {
    const { onStateChange } = renderBrowser({
      initialState: {
        ...DEFAULT_MODPACK_BROWSER_STATE,
        query: 'alpha',
        sortBy: 'alphabetical',
        filterMCVersion: '1.20.1',
        filterLoader: 'fabric',
        currentPage: 3,
      },
    });

    await screen.findByText('Alpha Pack');

    expect(screen.getByText('Active filters')).toBeTruthy();
    expect(screen.getByText('"alpha"')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));

    await waitFor(() => {
      expect((screen.getByRole('textbox', { name: 'Enter modpack name...' }) as HTMLInputElement).value).toBe('');
    });
    await waitFor(() => {
      expect(onStateChange).toHaveBeenLastCalledWith(expect.objectContaining({
        platform: 'modrinth',
        query: '',
        sortBy: 'popularity',
        filterMCVersion: 'all',
        filterLoader: 'all',
        currentPage: 1,
      }));
    });
  });

  it('keeps browser filters wrap-friendly and routes no-art cards through the launcher mark fallback', async () => {
    renderBrowser();

    await screen.findByText('Alpha Pack');

    const searchRegion = screen.getByRole('search', { name: 'Enter modpack name...' });
    const controlsRow = searchRegion.querySelector('.flex.flex-wrap.items-start.gap-2');
    const sortShell = screen.getByRole('combobox', { name: 'Popularity' }).parentElement?.parentElement;
    const versionShell = screen.getByRole('combobox', { name: 'All MC Versions' }).parentElement?.parentElement;
    const loaderShell = screen.getByRole('combobox', { name: 'All Modloaders' }).parentElement?.parentElement;
    const pageSizeShell = screen.getByRole('combobox', { name: 'Items per page' }).parentElement?.parentElement;

    expect(controlsRow?.className).toContain('flex-wrap');
    expect(sortShell?.className).toContain('min-w-[11rem]');
    expect(sortShell?.className).toContain('flex-1');
    expect(versionShell?.className).toContain('min-w-[11rem]');
    expect(versionShell?.className).toContain('flex-1');
    expect(loaderShell?.className).toContain('min-w-[11rem]');
    expect(loaderShell?.className).toContain('flex-1');
    expect(pageSizeShell?.className).toContain('min-w-[8.5rem]');
    expect(pageSizeShell?.className).toContain('flex-none');

    await waitFor(() => {
      expect(screen.getByRole('img', { name: 'Alpha Pack' }).getAttribute('src')).toBe(LAUNCHER_MARK_PATH);
    });
  });
});
