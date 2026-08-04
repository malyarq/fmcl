// @vitest-environment jsdom

import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTranslator } from '../../../contexts/settings/i18n';
import { AddModModal } from '../AddModModal';

const searchModsMock = vi.fn();
const snapshotMock = vi.fn();

function mockMatchMedia() {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

vi.mock('../../../contexts/SettingsContext', () => ({
  useSettings: () => ({
    t: createTranslator('en'),
    getAccentStyles: () => ({ className: '', style: undefined }),
    formatNumber: (value: number, options?: Intl.NumberFormatOptions) => new Intl.NumberFormat('en-US', options).format(value),
    minecraftPath: '/minecraft',
  }),
}));

vi.mock('../../../contexts/ToastContext', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('../../../hooks/useDebounce', () => ({
  useDebounce: <T,>(value: T) => value,
}));

vi.mock('../../../services/ipc/modsIPC', () => ({
  modsIPC: {
    searchMods: (...args: unknown[]) => searchModsMock(...args),
    getModVersions: vi.fn(),
    installModFile: vi.fn(),
  },
}));

vi.mock('../../../services/ipc/instancesIPC', () => ({
  instancesIPC: {
    snapshot: (...args: unknown[]) => snapshotMock(...args),
  },
}));

describe('AddModModal flow layout', () => {
  beforeEach(() => {
    mockMatchMedia();
    searchModsMock.mockReset();
    snapshotMock.mockReset();

    searchModsMock.mockResolvedValue({
      items: [
        {
          platform: 'modrinth',
          projectId: 'iris',
          title: 'Iris',
          description: 'Shader loader',
        },
      ],
      total: 1,
    });
    snapshotMock.mockResolvedValue({
      ok: true,
      value: {
        id: 'alpha',
        name: 'Alpha Pack',
        metadata: { source: 'local', createdAt: '2026-04-13T00:00:00.000Z', updatedAt: '2026-04-13T00:00:00.000Z' },
        config: { runtime: { minecraftVersion: '1.20.1', modLoader: { type: 'fabric' } } },
        summary: { minecraftVersion: '1.20.1', modLoader: { type: 'fabric' } },
      },
    });
  });

  it('moves modal result streaming into its own viewport so the action rail stays reachable', async () => {
    render(
      <AddModModal
        modpackId="alpha"
        isOpen
        onClose={vi.fn()}
      />,
    );

    const dialog = await screen.findByRole('dialog', { name: /Add mods/ });

    await waitFor(() => {
      expect(searchModsMock).toHaveBeenCalled();
    });

    expect(await screen.findByText('Iris')).toBeTruthy();

    const modalBody = dialog.querySelector<HTMLElement>('[data-modal-body="true"]');
    const resultsScroll = screen.getByTestId('add-mod-modal-results-scroll');
    const results = screen.getByTestId('add-mod-modal-results');
    const actions = screen.getByTestId('add-mod-modal-actions');

    expect(modalBody).toBeTruthy();
    expect(modalBody?.className).toContain('flex-1');
    expect(modalBody?.style.overflow).toBe('hidden');
    expect(resultsScroll.className).toContain('overflow-y-auto');
    expect(resultsScroll.contains(results)).toBe(true);
    expect(resultsScroll.contains(actions)).toBe(false);
    expect(modalBody?.contains(actions)).toBe(true);
  });
});
