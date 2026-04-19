// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ModpackList } from '../ModpackList';
import { createTranslator } from '../../../contexts/settings/i18n';

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

function renderList() {
  const onNavigate = vi.fn();

  render(<ModpackList onNavigate={onNavigate} />);

  return { onNavigate };
}

describe('ModpackList degraded states', () => {
  beforeEach(() => {
    cleanup();
    listWithMetadataMock.mockReset();
    selectMock.mockReset();
    refreshMock.mockReset();

    selectMock.mockResolvedValue(undefined);
    refreshMock.mockResolvedValue(undefined);
  });

  it('shows an explicit load error instead of collapsing into the empty catalog state', async () => {
    listWithMetadataMock
      .mockRejectedValueOnce(new Error('[IPC] list failed: Library unavailable'))
      .mockResolvedValueOnce([
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

    renderList();

    const errorState = await screen.findByRole('alert');
    expect(screen.getByRole('heading', { name: t('error.inline_fallback') })).toBeTruthy();
    expect(errorState.textContent).toContain(t('degraded.error_label'));
    expect(errorState.textContent).not.toContain(t('modpacks.no_modpacks_title'));

    fireEvent.click(screen.getByRole('button', { name: t('modpacks.world_refresh') }));

    expect(await screen.findByText('Alpha Pack')).toBeTruthy();
  });

  it('keeps search zero-results separate from the true empty installed-catalog state', async () => {
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

    renderList();

    expect(await screen.findByText('Alpha Pack')).toBeTruthy();

    fireEvent.change(screen.getByRole('textbox', { name: t('modpacks.search_placeholder') }), {
      target: { value: 'zzz' },
    });

    const zeroResultsHeading = await screen.findByRole('heading', { name: t('modpacks.no_results') });
    const zeroResultsState = zeroResultsHeading.closest('section');
    expect(zeroResultsState).not.toBeNull();

    fireEvent.click(within(zeroResultsState as HTMLElement).getByRole('button', { name: t('modpacks.clear_filters') }));

    await waitFor(() => {
      expect((screen.getByRole('textbox', { name: t('modpacks.search_placeholder') }) as HTMLInputElement).value).toBe('');
    });

    expect(screen.getByText('Alpha Pack')).toBeTruthy();
  });

  it('shows a calm empty state with a route-owned browser action when no packs are installed', async () => {
    listWithMetadataMock.mockResolvedValue([]);

    const { onNavigate } = renderList();

    const emptyHeading = await screen.findByRole('heading', { name: t('modpacks.no_modpacks_title') });
    const emptyState = emptyHeading.closest('section');
    expect(emptyState).not.toBeNull();

    fireEvent.click(within(emptyState as HTMLElement).getByRole('button', { name: t('modpacks.browser') }));

    expect(onNavigate).toHaveBeenCalledWith({ type: 'browser' });
  });
});
