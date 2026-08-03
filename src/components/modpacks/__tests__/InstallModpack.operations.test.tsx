// @vitest-environment jsdom

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OperationSnapshot } from '@shared/contracts';
import { InstallModpackPage } from '../InstallModpackPage';

const startMock = vi.fn();
const subscribeMock = vi.fn();
const cancelMock = vi.fn();
const setSelectedMock = vi.fn();
const successMock = vi.fn();
let listener: ((snapshot: OperationSnapshot) => void) | undefined;
let unsubscribeMock: ReturnType<typeof vi.fn>;

vi.mock('../../../contexts/SettingsContext', () => ({
  useSettings: () => ({
    t: (key: string) => ({
      'modpacks.install': 'Install',
      'modpacks.installing': 'Installing',
      'general.cancel': 'Cancel',
      'general.back': 'Back',
    })[key] || key,
    getAccentStyles: () => ({ className: '', style: undefined }),
  }),
}));

vi.mock('../../../contexts/ToastContext', () => ({
  useToast: () => ({ success: successMock, error: vi.fn(), info: vi.fn() }),
}));

vi.mock('../../../services/ipc/modpacksIPC', () => ({
  modpacksIPC: { setSelected: (...args: unknown[]) => setSelectedMock(...args) },
}));

vi.mock('../../../services/ipc/operationsIPC', () => ({
  operationsIPC: {
    start: (...args: unknown[]) => startMock(...args),
    subscribe: (...args: unknown[]) => subscribeMock(...args),
    cancel: (...args: unknown[]) => cancelMock(...args),
  },
}));

const queued: OperationSnapshot = {
  id: 'provider-operation',
  kind: 'install-modrinth',
  status: 'queued',
  phase: 'started',
  progress: { completed: 0, total: 2 },
  createdAt: '2026-08-03T00:00:00.000Z',
  updatedAt: '2026-08-03T00:00:00.000Z',
};

function snapshot(status: OperationSnapshot['status']): OperationSnapshot {
  return {
    ...queued,
    status,
    phase: status === 'cancelled' ? 'cancelled' : status === 'failed' ? 'failed' : 'completed',
    result: status === 'succeeded'
      ? { status: 'succeeded', instanceId: 'installed-pack' }
      : status === 'recovered'
        ? { status: 'recovered', instanceId: 'installed-pack' }
        : status === 'degraded'
          ? { status: 'degraded', missing: [{ path: 'mods/optional.jar', reason: 'not found' }] }
          : status === 'cancelled'
            ? { status: 'cancelled' }
            : status === 'failed'
              ? { status: 'failed', code: 'download-failed', message: 'Download failed' }
              : undefined,
  };
}

function renderPage() {
  return render(
    <InstallModpackPage
      modpack={{ platform: 'modrinth', projectId: 'project', title: 'Pack' }}
      versions={[{ platform: 'modrinth', versionId: 'version', name: 'Version', mcVersions: ['1.20.1'], loaders: ['fabric'], files: [] }]}
      platform="modrinth"
      onBack={vi.fn()}
    />,
  );
}

describe('InstallModpackPage provider operations', () => {
  beforeEach(() => {
    listener = undefined;
    unsubscribeMock = vi.fn();
    startMock.mockReset().mockResolvedValue(queued);
    subscribeMock.mockReset().mockImplementation(async (_id: string, nextListener: (next: OperationSnapshot) => void) => {
      listener = nextListener;
      return unsubscribeMock;
    });
    cancelMock.mockReset().mockResolvedValue({ cancelled: true });
    setSelectedMock.mockReset().mockResolvedValue({ ok: true });
    successMock.mockReset();
  });

  afterEach(() => vi.useRealTimers());

  it('keeps one operation id, renders truthful terminal states, and unsubscribes once', async () => {
    const { unmount } = renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Install' }));

    await waitFor(() => expect(startMock).toHaveBeenCalledWith({
      kind: 'install-modrinth', projectId: 'project', versionId: 'version',
    }));
    await waitFor(() => expect(subscribeMock).toHaveBeenCalledWith('provider-operation', expect.any(Function)));

    for (const status of ['running', 'cancelling', 'failed'] as const) {
      act(() => listener?.(snapshot(status)));
      expect(screen.getByTestId('provider-install-operation').getAttribute('data-operation-status')).toBe(status);
    }

    expect(successMock).not.toHaveBeenCalled();
    expect(setSelectedMock).not.toHaveBeenCalled();
    expect(unsubscribeMock).toHaveBeenCalledTimes(1);
    unmount();
    expect(unsubscribeMock).toHaveBeenCalledTimes(1);
  });

  it.each(['cancelled', 'degraded', 'recovered', 'succeeded'] as const)(
    'renders %s without reporting a false success',
    async (status) => {
      renderPage();
      fireEvent.click(screen.getByRole('button', { name: 'Install' }));
      await waitFor(() => expect(listener).toBeTypeOf('function'));
      act(() => listener?.(snapshot(status)));

      expect(screen.getByTestId('provider-install-operation').getAttribute('data-operation-status')).toBe(status);
      if (status === 'cancelled' || status === 'degraded') {
        expect(successMock).not.toHaveBeenCalled();
      }
    },
  );

  it('requests cancellation at most once for the active operation', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Install' }));
    await waitFor(() => expect(listener).toBeTypeOf('function'));
    await waitFor(() => expect(screen.getByTestId('provider-install-operation')).toBeTruthy());

    fireEvent.click(screen.getAllByRole('button', { name: 'Cancel' }).at(-1)!);
    fireEvent.click(screen.getAllByRole('button', { name: 'Cancel' }).at(-1)!);

    await waitFor(() => expect(cancelMock).toHaveBeenCalledTimes(1));
    expect(cancelMock).toHaveBeenCalledWith('provider-operation');
  });
});
