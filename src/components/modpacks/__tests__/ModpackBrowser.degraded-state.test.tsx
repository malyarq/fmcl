// @vitest-environment jsdom

import type { ComponentProps } from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ModpackBrowser } from '../ModpackBrowser';
import { DEFAULT_MODPACK_BROWSER_STATE } from '../../../features/modpacks/hooks/useModpackNavigation';
import { createTranslator } from '../../../contexts/settings/i18n';

const searchModrinthMock = vi.fn();
const getCurseForgeVersionsMock = vi.fn();
const getModrinthVersionsMock = vi.fn();
const showOpenDialogMock = vi.fn();
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

vi.mock('../../../services/ipc/modpacksIPC', () => ({
  modpacksIPC: {
    searchModrinth: (...args: unknown[]) => searchModrinthMock(...args),
    getCurseForgeVersions: (...args: unknown[]) => getCurseForgeVersionsMock(...args),
    getModrinthVersions: (...args: unknown[]) => getModrinthVersionsMock(...args),
  },
}));

vi.mock('../../../services/ipc/dialogIPC', () => ({
  dialogIPC: {
    showOpenDialog: (...args: unknown[]) => showOpenDialogMock(...args),
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

describe('ModpackBrowser degraded states', () => {
  beforeEach(() => {
    cleanup();
    localStorage.clear();
    searchModrinthMock.mockReset();
    getCurseForgeVersionsMock.mockReset();
    getModrinthVersionsMock.mockReset();
    showOpenDialogMock.mockReset();

    getCurseForgeVersionsMock.mockResolvedValue([]);
    getModrinthVersionsMock.mockResolvedValue([]);
    showOpenDialogMock.mockResolvedValue({ canceled: true, filePaths: [] });
  });

  it('shows an explicit error state for failed remote search and retries into normal results', async () => {
    searchModrinthMock
      .mockRejectedValueOnce(new Error('[MODRINTH] search failed: Remote catalogue unavailable'))
      .mockResolvedValueOnce({
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
        total: 1,
        offset: 0,
        limit: 12,
      });

    renderBrowser();

    const errorState = await screen.findByRole('alert');
    expect(screen.getByRole('heading', { name: t('error.inline_fallback') })).toBeTruthy();
    expect(errorState.textContent).toContain(t('degraded.error_label'));
    expect(errorState.textContent).not.toContain(t('modpacks.no_results'));

    fireEvent.click(screen.getByRole('button', { name: t('modpacks.search_btn') }));

    expect(await screen.findByText('Alpha Pack')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('keeps zero-result filters distinct from the neutral empty browse state', async () => {
    searchModrinthMock
      .mockResolvedValueOnce({
        items: [],
        total: 0,
        offset: 0,
        limit: 12,
      })
      .mockResolvedValueOnce({
        items: [],
        total: 0,
        offset: 0,
        limit: 12,
      });

    renderBrowser({
      initialState: {
        ...DEFAULT_MODPACK_BROWSER_STATE,
        query: 'zzz',
      },
    });

    const zeroResultsHeading = await screen.findByRole('heading', { name: t('modpacks.no_results') });
    const zeroResultsState = zeroResultsHeading.closest('section');
    expect(zeroResultsState).not.toBeNull();

    fireEvent.click(within(zeroResultsState as HTMLElement).getByRole('button', { name: t('modpacks.clear_filters') }));

    await waitFor(() => {
      expect((screen.getByRole('textbox', { name: t('modpacks.search_placeholder') }) as HTMLInputElement).value).toBe('');
    });

    const emptyHeading = await screen.findByRole('heading', { name: t('modpacks.results_summary_empty') });
    const emptyState = emptyHeading.closest('section');
    expect(emptyState).not.toBeNull();
    expect(within(emptyState as HTMLElement).getByRole('button', { name: t('modpacks.import') })).toBeTruthy();
  });
});
