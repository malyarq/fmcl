// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OperationSnapshot } from '@shared/contracts';
import { ModpackList } from '../ModpackList';
import { createTranslator } from '../../../contexts/settings/i18n';
import { instancesFromListFixture } from './instancesListFixture';

const instancesListFixtureMock = vi.fn();
const selectMock = vi.fn();
const refreshMock = vi.fn();
const loadSelectedMock = vi.fn();
const startMock = vi.fn();
const subscribeMock = vi.fn();
const unsubscribeMock = vi.fn();
const confirmMock = vi.fn();
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
    loadSelected: (...args: unknown[]) => loadSelectedMock(...args),
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
    confirm: (...args: unknown[]) => confirmMock(...args),
    prompt: vi.fn(),
  }),
}));

vi.mock('../../../services/ipc/operationsIPC', () => ({
  operationsIPC: {
    start: (...args: unknown[]) => startMock(...args),
    subscribe: (...args: unknown[]) => subscribeMock(...args),
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

  const rendered = render(<ModpackList onNavigate={onNavigate} />);

  return { onNavigate, ...rendered };
}

describe('ModpackList degraded states', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'api', { configurable: true, value: { instances: instancesFromListFixture(() => instancesListFixtureMock()) } });
    cleanup();
    instancesListFixtureMock.mockReset();
    selectMock.mockReset();
    refreshMock.mockReset();
    loadSelectedMock.mockReset();
    startMock.mockReset();
    subscribeMock.mockReset();
    unsubscribeMock.mockReset();
    confirmMock.mockReset();

    selectMock.mockResolvedValue(undefined);
    refreshMock.mockResolvedValue(undefined);
    loadSelectedMock.mockResolvedValue(undefined);
    confirmMock.mockResolvedValue(true);
  });

  it('shows an explicit load error instead of collapsing into the empty catalog state', async () => {
    instancesListFixtureMock
      .mockRejectedValueOnce(new Error('[IPC] list failed: Library unavailable'))
      .mockResolvedValueOnce([
        {
          id: 'alpha',
          name: 'Alpha Pack',
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
    instancesListFixtureMock.mockResolvedValue([
      {
        id: 'alpha',
        name: 'Alpha Pack',
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
    instancesListFixtureMock.mockResolvedValue([]);

    const { onNavigate } = renderList();

    const emptyHeading = await screen.findByRole('heading', { name: t('modpacks.no_modpacks_title') });
    const emptyState = emptyHeading.closest('section');
    expect(emptyState).not.toBeNull();

    fireEvent.click(within(emptyState as HTMLElement).getByRole('button', { name: t('modpacks.browser') }));

    expect(onNavigate).toHaveBeenCalledWith({ type: 'browser' });
  });

  it.each(['running', 'cancelling', 'cancelled', 'failed', 'degraded', 'recovered', 'succeeded'] as const)(
    'renders delete operation %s without optimistic removal or false success',
    async (status) => {
      let listener: ((snapshot: OperationSnapshot) => void) | undefined;
      instancesListFixtureMock.mockResolvedValue([alphaPack]);
      startMock.mockResolvedValue(deleteSnapshot('queued'));
      subscribeMock.mockImplementation(async (_id: string, nextListener: (snapshot: OperationSnapshot) => void) => {
        listener = nextListener;
        return unsubscribeMock;
      });

      renderList();
      expect(await screen.findByText('Alpha Pack')).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: /more actions: alpha pack/i }));
      fireEvent.click(screen.getByRole('menuitem', { name: t('modpacks.delete') }));

      await waitFor(() => expect(startMock).toHaveBeenCalledWith({ kind: 'delete', instanceId: 'alpha' }));
      await waitFor(() => expect(listener).toBeTypeOf('function'));
      act(() => listener?.(deleteSnapshot(status)));

      expect(screen.getByTestId('delete-operation-status').getAttribute('data-operation-status')).toBe(status);
      expect(screen.getByText('Alpha Pack')).toBeTruthy();
      if (status === 'succeeded' || status === 'recovered') {
        await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1));
      } else {
        expect(refreshMock).not.toHaveBeenCalled();
      }
      if (['cancelled', 'failed', 'degraded', 'recovery-required'].includes(status)) {
        expect(screen.getByText('Alpha Pack')).toBeTruthy();
      }
    },
  );

  it('unsubscribes exactly once after a delete terminal snapshot', async () => {
    let listener: ((snapshot: OperationSnapshot) => void) | undefined;
    instancesListFixtureMock.mockResolvedValue([alphaPack]);
    startMock.mockResolvedValue(deleteSnapshot('queued'));
    subscribeMock.mockImplementation(async (_id: string, nextListener: (snapshot: OperationSnapshot) => void) => {
      listener = nextListener;
      return unsubscribeMock;
    });

    const { unmount } = renderList();
    expect(await screen.findByText('Alpha Pack')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /more actions: alpha pack/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: t('modpacks.delete') }));
    await waitFor(() => expect(listener).toBeTypeOf('function'));
    act(() => listener?.(deleteSnapshot('failed')));

    await waitFor(() => expect(unsubscribeMock).toHaveBeenCalledTimes(1));
    unmount();
    expect(unsubscribeMock).toHaveBeenCalledTimes(1);
  });
});

const alphaPack = {
  id: 'alpha',
  name: 'Alpha Pack',
  selected: false,
  metadata: {
    description: 'Route truth test pack',
    version: '1.2.0',
    minecraftVersion: '1.20.1',
    modLoader: { type: 'fabric' as const },
  },
};

function deleteSnapshot(status: OperationSnapshot['status']): OperationSnapshot {
  return {
    id: 'delete-operation',
    kind: 'delete',
    status,
    phase: status === 'failed' ? 'failed' : status === 'cancelled' ? 'cancelled' : 'completed',
    progress: { completed: 1, total: 1 },
    createdAt: '2026-08-03T00:00:00.000Z',
    updatedAt: '2026-08-03T00:00:00.000Z',
    result: status === 'succeeded' || status === 'recovered'
      ? { status, instanceId: 'alpha' }
      : status === 'failed'
        ? { status, code: 'DELETE_FAILED', message: 'Delete failed' }
        : status === 'cancelled'
          ? { status }
          : status === 'degraded'
            ? { status, missing: [] }
            : undefined,
  } as OperationSnapshot;
}
