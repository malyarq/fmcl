// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OperationSnapshot } from '@shared/contracts';
import { ExportModpackModal } from '../ExportModpackModal';
import { ExportModpackPage } from '../ExportModpackPage';

const snapshotMock = vi.fn();
const showSaveDialogMock = vi.fn();
const startMock = vi.fn();
const subscribeMock = vi.fn();
const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();

const operationId = '11111111-1111-1111-1111-111111111111';

vi.mock('../../../contexts/SettingsContext', () => ({
  useSettings: () => ({
    t: (key: string) => ({
      'modpacks.export': 'Export',
      'modpacks.export_title': 'Export Modpack',
      'modpacks.export_desc': 'Export {{name}}',
      'modpacks.export_format': 'Export Format',
      'modpacks.export_format_multimc': 'MultiMC',
      'modpacks.export_format_zip': 'ZIP',
      'modpacks.exporting': 'Exporting...',
      'modpacks.export_success': 'Export completed',
      'modpacks.export_error': 'Export failed',
      'modpacks.select_export_path': 'Choose export path',
      'modpacks.export_options': 'Export options',
      'settings.browse': 'Browse',
      'general.cancel': 'Cancel',
      'general.back': 'Back',
      'modpacks.title': 'Modpacks',
    }[key] ?? key),
    getAccentStyles: () => ({ className: '', style: undefined }),
    minecraftPath: '/minecraft',
  }),
}));

vi.mock('../../../contexts/ToastContext', () => ({
  useToast: () => ({ success: toastSuccessMock, error: toastErrorMock }),
}));

vi.mock('../../../services/ipc/instancesIPC', () => ({
  instancesIPC: { snapshot: (...args: unknown[]) => snapshotMock(...args) },
}));

vi.mock('../../../services/ipc/dialogIPC', () => ({
  dialogIPC: {
    getDesktopPath: vi.fn().mockResolvedValue('/desktop'),
    showSaveDialog: (...args: unknown[]) => showSaveDialogMock(...args),
  },
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
          ? { status, code: 'EXPORT_FAILED', message: 'Operation failed' }
          : status === 'cancelled'
            ? { status }
            : undefined;

  return {
    id: operationId,
    kind: 'export',
    status,
    phase: status === 'failed' ? 'failed' : status === 'cancelled' ? 'cancelled' : 'completed',
    progress: { completed: 1, total: 1 },
    createdAt: '2026-08-03T00:00:00.000Z',
    updatedAt: '2026-08-03T00:00:01.000Z',
    result,
  } as OperationSnapshot;
}

async function startPageExport(): Promise<(next: OperationSnapshot) => void> {
  fireEvent.click(screen.getByRole('button', { name: 'Export' }));
  await waitFor(() => expect(showSaveDialogMock).toHaveBeenCalledOnce());
  await waitFor(() => expect(startMock).toHaveBeenCalledWith({
    kind: 'export',
    instanceId: 'alpha',
    format: 'multimc',
    outputPath: '/exports/alpha.zip',
    options: {
      includeSaves: false,
      includeScreenshots: false,
      includeResourcePacks: false,
      includeShaders: false,
      includeMods: true,
    },
  }));
  await waitFor(() => expect(subscribeMock).toHaveBeenCalledWith(operationId, expect.any(Function)));
  return subscribeMock.mock.calls[0][1] as (next: OperationSnapshot) => void;
}

describe('ExportModpack operation state', () => {
  beforeEach(() => {
    cleanup();
    snapshotMock.mockReset().mockResolvedValue({
      ok: true,
      value: {
        id: 'alpha',
        name: 'Alpha Pack',
        metadata: { source: 'local', createdAt: '2026-08-03T00:00:00.000Z', updatedAt: '2026-08-03T00:00:00.000Z' },
        config: { runtime: { minecraftVersion: '1.20.1' } },
        summary: { minecraftVersion: '1.20.1' },
      },
    });
    showSaveDialogMock.mockReset().mockResolvedValue({ canceled: false, filePath: '/exports/alpha.zip' });
    startMock.mockReset().mockResolvedValue(snapshot('queued'));
    subscribeMock.mockReset();
    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();
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

  it('does not start an export when the native save dialog is cancelled', async () => {
    showSaveDialogMock.mockResolvedValue({ canceled: true, filePath: undefined });
    render(<ExportModpackPage modpackId="alpha" onBack={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Export' }));

    await waitFor(() => expect(showSaveDialogMock).toHaveBeenCalledOnce());
    expect(startMock).not.toHaveBeenCalled();
    expect(subscribeMock).not.toHaveBeenCalled();
  });

  it.each(['running', 'cancelling', 'cancelled', 'failed', 'degraded', 'recovered', 'succeeded'] as const)(
    'renders the truthful %s export state without optimistic success',
    async (status) => {
      const unsubscribe = vi.fn();
      subscribeMock.mockResolvedValue(unsubscribe);
      const onBack = vi.fn();
      render(<ExportModpackPage modpackId="alpha" onBack={onBack} />);

      const listener = await startPageExport();
      expect(toastSuccessMock).not.toHaveBeenCalled();
      await act(async () => listener(snapshot(status)));

      expect((await screen.findByTestId('export-operation-status')).textContent).toContain(status);
      if (status === 'succeeded' || status === 'recovered') {
        expect(toastSuccessMock).toHaveBeenCalledOnce();
        expect(onBack).toHaveBeenCalledOnce();
      } else {
        expect(toastSuccessMock).not.toHaveBeenCalled();
        expect(onBack).not.toHaveBeenCalled();
      }
    },
  );

  it('releases the exact listener once after a terminal export and on unmount', async () => {
    const unsubscribe = vi.fn();
    subscribeMock.mockResolvedValue(unsubscribe);
    const rendered = render(<ExportModpackPage modpackId="alpha" onBack={vi.fn()} />);

    const listener = await startPageExport();
    await act(async () => listener(snapshot('failed')));
    rendered.unmount();

    expect(unsubscribe).toHaveBeenCalledOnce();
  });

  it('keeps the modal open after a failed operation and closes it only after a recovered export', async () => {
    const unsubscribe = vi.fn();
    subscribeMock.mockResolvedValue(unsubscribe);
    const onClose = vi.fn();
    const onExported = vi.fn();
    render(<ExportModpackModal modpackId="alpha" modpackName="Alpha Pack" isOpen onClose={onClose} onExported={onExported} />);

    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    await waitFor(() => expect(startMock).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'export',
      outputPath: '/exports/alpha.zip',
    })));
    const listener = subscribeMock.mock.calls[0][1] as (next: OperationSnapshot) => void;
    await act(async () => listener(snapshot('failed')));
    expect(onClose).not.toHaveBeenCalled();
    expect(onExported).not.toHaveBeenCalled();

    await act(async () => listener(snapshot('recovered')));
    expect(onClose).toHaveBeenCalledOnce();
    expect(onExported).toHaveBeenCalledOnce();
    expect(unsubscribe).toHaveBeenCalledOnce();
  });
});
