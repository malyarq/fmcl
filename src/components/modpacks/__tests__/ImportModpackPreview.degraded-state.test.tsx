// @vitest-environment jsdom

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ImportModpackPreviewModal } from '../ImportModpackPreviewModal';
import { ImportModpackPreviewPage } from '../ImportModpackPreviewPage';
import type { OperationSnapshot } from '@shared/contracts';

const refreshMock = vi.fn();
const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();
const startMock = vi.fn();
const subscribeMock = vi.fn();

const operationId = '11111111-1111-1111-1111-111111111111';
const manifest = {
  formatVersion: 1,
  name: 'Alpha Pack',
  version: '1.0.0',
  minecraft: { version: '1.20.1', modLoaders: [] },
  files: [],
};
const inspection = { format: 'modrinth' as const, manifest };

vi.mock('../../../contexts/SettingsContext', () => ({
  useSettings: () => ({
    t: (key: string) => ({
      'modpacks.import_preview': 'Import Preview',
      'modpacks.loading': 'Loading...',
      'modpacks.unable_to_load_info': 'Unable to load modpack information',
      'modpacks.import': 'Import',
      'modpacks.import_success': 'Import completed',
      'modpacks.import_error': 'Import failed',
      'general.back': 'Back',
      'general.cancel': 'Cancel',
      'degraded.error_label': 'Needs attention',
    }[key] ?? key),
    getAccentStyles: () => ({ className: '', style: undefined }),
    formatNumber: (value: number) => String(value),
  }),
}));

vi.mock('../../../contexts/ToastContext', () => ({
  useToast: () => ({ success: toastSuccessMock, error: toastErrorMock }),
}));

vi.mock('../../../contexts/ModpackContext', () => ({
  useModpackListContext: () => ({ refresh: refreshMock }),
}));

vi.mock('../../../services/ipc/operationsIPC', () => ({
  operationsIPC: {
    start: (...args: unknown[]) => startMock(...args),
    subscribe: (...args: unknown[]) => subscribeMock(...args),
  },
}));

function snapshot(status: OperationSnapshot['status']): OperationSnapshot {
  const result = status === 'succeeded'
    ? { status, instanceId: 'alpha' }
    : status === 'recovered'
      ? { status, instanceId: 'alpha' }
      : status === 'degraded'
        ? { status, missing: ['optional-item'] }
        : status === 'failed'
          ? { status, code: 'IMPORT_FAILED', message: 'Operation failed' }
          : status === 'recovery-required'
            ? { status, message: 'Operation recovery requires attention' }
            : status === 'cancelled'
              ? { status }
              : undefined;

  return {
    id: operationId,
    kind: 'import',
    status,
    phase: status === 'failed' ? 'failed' : status === 'cancelled' ? 'cancelled' : 'completed',
    progress: { completed: 1, total: 1 },
    createdAt: '2026-08-03T00:00:00.000Z',
    updatedAt: '2026-08-03T00:00:01.000Z',
    result,
  } as OperationSnapshot;
}

async function startImport(): Promise<(next: OperationSnapshot) => void> {
  fireEvent.click(screen.getByRole('button', { name: 'Import' }));
  await waitFor(() => expect(startMock).toHaveBeenCalledWith({ kind: 'import', archiveRef: 'archive-ref' }));
  await waitFor(() => expect(subscribeMock).toHaveBeenCalledWith(operationId, expect.any(Function)));
  return subscribeMock.mock.calls[0][1] as (next: OperationSnapshot) => void;
}

describe('ImportModpackPreview operation state', () => {
  beforeEach(() => {
    refreshMock.mockReset();
    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();
    startMock.mockReset();
    subscribeMock.mockReset();
    startMock.mockResolvedValue(snapshot('queued'));
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
      })),
    });
  });

  it.each(['running', 'cancelling', 'cancelled', 'failed', 'degraded', 'recovered', 'succeeded'] as const)(
    'renders the truthful %s import state and only refreshes published results',
    async (status) => {
      const unsubscribe = vi.fn();
      subscribeMock.mockResolvedValue(unsubscribe);
      const onBack = vi.fn();
      render(<ImportModpackPreviewPage archiveRef="archive-ref" inspection={inspection} onBack={onBack} />);

      await screen.findByText('Alpha Pack');
      const listener = await startImport();
      await act(async () => listener(snapshot(status)));

      expect((await screen.findByTestId('import-operation-status')).textContent).toContain(status);
      if (status === 'succeeded' || status === 'recovered') {
        await waitFor(() => expect(refreshMock).toHaveBeenCalledOnce());
        expect(toastSuccessMock).toHaveBeenCalledOnce();
      } else {
        expect(refreshMock).not.toHaveBeenCalled();
        expect(toastSuccessMock).not.toHaveBeenCalled();
        expect(onBack).not.toHaveBeenCalled();
      }
    },
  );

  it('releases the exact page listener once on terminal completion and unmount', async () => {
    const unsubscribe = vi.fn();
    subscribeMock.mockResolvedValue(unsubscribe);
    const rendered = render(<ImportModpackPreviewPage archiveRef="archive-ref" inspection={inspection} onBack={vi.fn()} />);

    await screen.findByText('Alpha Pack');
    const listener = await startImport();
    await act(async () => listener(snapshot('failed')));
    rendered.unmount();

    expect(unsubscribe).toHaveBeenCalledOnce();
  });

  it('releases the modal listener on close and never treats a failed import as successful', async () => {
    const unsubscribe = vi.fn();
    subscribeMock.mockResolvedValue(unsubscribe);
    const onClose = vi.fn();
    const onImport = vi.fn();
    const rendered = render(
      <ImportModpackPreviewModal
        archiveRef="archive-ref"
        inspection={inspection}
        isOpen
        onClose={onClose}
        onImport={onImport}
      />,
    );

    await screen.findByText('Alpha Pack');
    const listener = await startImport();
    await act(async () => listener(snapshot('failed')));
    rendered.unmount();

    expect(onClose).not.toHaveBeenCalled();
    expect(onImport).not.toHaveBeenCalled();
    expect(refreshMock).not.toHaveBeenCalled();
    expect(toastSuccessMock).not.toHaveBeenCalled();
    expect(unsubscribe).toHaveBeenCalledOnce();
  });

});
