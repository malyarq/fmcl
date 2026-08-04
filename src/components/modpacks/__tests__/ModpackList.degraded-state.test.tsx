// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OperationSnapshot } from '@shared/contracts';
import { ModpackList } from '../ModpackList';
import { createTranslator } from '../../../contexts/settings/i18n';
import { instancesFromListFixture } from './instancesListFixture';

const instancesListFixtureMock = vi.fn();
const selectMock = vi.fn();
const refreshMock = vi.fn();
const removeMock = vi.fn();
const confirmMock = vi.fn();
const t = createTranslator('en');
let deleteOperationState: OperationSnapshot | null = null;
let canonicalInstanceListState = [{
  id: 'alpha',
  name: 'Alpha Pack',
  selected: false,
  summary: { minecraftVersion: '1.20.1', modLoader: { type: 'fabric' as const } },
}];

vi.mock('../../../features/instances/hooks/useInstanceSelectors', () => ({
  useInstanceList: () => ({ status: 'ready', data: canonicalInstanceListState }),
  useSelectedInstanceId: () => ({ status: 'ready', data: '' }),
}));

vi.mock('../../../features/instances/hooks/useInstanceInvalidation', () => ({
  useInstanceInvalidation: () => ({
    invalidateInstance: vi.fn(),
    invalidateInstances: (...args: unknown[]) => refreshMock(...args),
  }),
}));

vi.mock('../../../contexts/instances/hooks/useInstanceCrudActions', () => ({
  useInstanceCrudActions: () => ({
    select: (...args: unknown[]) => selectMock(...args),
    remove: (...args: unknown[]) => removeMock(...args),
    rename: vi.fn(),
    duplicate: vi.fn(),
    duplicateOperation: null,
    duplicateOperationError: null,
    cancelDuplicate: vi.fn(),
    retryDuplicate: vi.fn(),
    deleteOperation: deleteOperationState,
    deleteOperationError: null,
    cancelDelete: vi.fn(),
    retryDelete: vi.fn(),
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
    removeMock.mockReset().mockResolvedValue(undefined);
    confirmMock.mockReset();
    deleteOperationState = null;
    canonicalInstanceListState = [{
      id: 'alpha',
      name: 'Alpha Pack',
      selected: false,
      summary: { minecraftVersion: '1.20.1', modLoader: { type: 'fabric' } },
    }];

    selectMock.mockResolvedValue(undefined);
    refreshMock.mockResolvedValue(undefined);
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
    canonicalInstanceListState = [];

    const { onNavigate } = renderList();

    const emptyHeading = await screen.findByRole('heading', { name: t('modpacks.no_modpacks_title') });
    const emptyState = emptyHeading.closest('section');
    expect(emptyState).not.toBeNull();

    fireEvent.click(within(emptyState as HTMLElement).getByRole('button', { name: t('modpacks.browser') }));

    expect(onNavigate).toHaveBeenCalledWith({ type: 'browser' });
  });

  it('delegates confirmed deletion to the focused CRUD controller', async () => {
    instancesListFixtureMock.mockResolvedValue([alphaPack]);

    renderList();
    expect(await screen.findByText('Alpha Pack')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /more actions: alpha pack/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: t('modpacks.delete') }));

    await waitFor(() => expect(removeMock).toHaveBeenCalledWith('alpha'));
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it.each(['running', 'cancelling', 'cancelled', 'failed', 'degraded', 'recovered', 'succeeded'] as const)(
    'renders controller-owned delete operation %s without optimistic removal or false success',
    async (status) => {
      instancesListFixtureMock.mockResolvedValue([alphaPack]);
      deleteOperationState = deleteSnapshot(status);

      renderList();
      expect(await screen.findByText('Alpha Pack')).toBeTruthy();

      expect(screen.getByTestId('delete-operation-status').getAttribute('data-operation-status')).toBe(status);
      expect(screen.getByText('Alpha Pack')).toBeTruthy();
      expect(refreshMock).not.toHaveBeenCalled();
      if (['cancelled', 'failed', 'degraded', 'recovery-required'].includes(status)) {
        expect(screen.getByText('Alpha Pack')).toBeTruthy();
      }
    },
  );
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
