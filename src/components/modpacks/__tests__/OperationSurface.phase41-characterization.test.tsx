// @vitest-environment jsdom

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OperationSnapshot } from '@shared/contracts';
import { ImportModpackPreviewPage } from '../ImportModpackPreviewPage';
import { OperationStatusView } from '../../../features/operations/components/OperationStatusView';

const mocks = vi.hoisted(() => ({
  start: vi.fn(),
  subscribe: vi.fn(),
  refresh: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock('../../../contexts/SettingsContext', () => ({
  useSettings: () => ({
    t: (key: string) => key,
    getAccentStyles: () => ({ className: '', style: undefined }),
    formatNumber: (value: number) => String(value),
  }),
}));

vi.mock('../../../contexts/ToastContext', () => ({
  useToast: () => ({ success: mocks.toastSuccess, error: vi.fn() }),
}));

vi.mock('../../../features/instances/hooks/useInstanceInvalidation', () => ({
  useInstanceInvalidation: () => ({ invalidateInstances: mocks.refresh }),
}));

vi.mock('../../../services/ipc/operationsIPC', () => ({
  operationsIPC: {
    start: (...args: unknown[]) => mocks.start(...args),
    subscribe: (...args: unknown[]) => mocks.subscribe(...args),
  },
}));

const operationId = '11111111-1111-1111-1111-111111111111';
const inspection = {
  format: 'modrinth' as const,
  manifest: {
    formatVersion: 1,
    name: 'Characterized Pack',
    version: '1.0.0',
    minecraft: { version: '1.20.1', modLoaders: [] },
    files: [],
  },
};

function operation(
  status: OperationSnapshot['status'],
  kind: OperationSnapshot['kind'] = 'import',
): OperationSnapshot {
  const result: OperationSnapshot['result'] = status === 'succeeded'
    ? { status, instanceId: 'published-pack' }
    : status === 'recovered'
      ? { status, instanceId: 'published-pack' }
      : status === 'degraded'
        ? { status, instanceId: 'published-pack', missing: ['optional.jar'] }
        : status === 'failed'
          ? { status, code: 'FAILED', message: 'Operation failed' }
          : status === 'recovery-required'
            ? { status, message: 'Recovery needs attention' }
            : status === 'cancelled'
              ? { status }
              : undefined;

  return {
    id: operationId,
    kind,
    status,
    phase: status === 'failed'
      ? 'failed'
      : status === 'cancelled'
        ? 'cancelled'
        : status === 'recovery-required'
          ? 'recovery-required'
          : status === 'queued' || status === 'running' || status === 'cancelling'
            ? 'started'
            : 'completed',
    progress: { completed: status === 'queued' ? 0 : 1, total: 1 },
    createdAt: '2026-08-04T00:00:00.000Z',
    updatedAt: '2026-08-04T00:00:01.000Z',
    result,
  };
}

function renderImportPage() {
  return render(
    <ImportModpackPreviewPage
      archiveRef="opaque-archive-ref"
      inspection={inspection}
      onBack={vi.fn()}
    />,
  );
}

describe('Phase 41 operation-surface characterization', () => {
  beforeEach(() => {
    mocks.start.mockReset().mockResolvedValue(operation('queued'));
    mocks.subscribe.mockReset();
    mocks.refresh.mockReset().mockResolvedValue(undefined);
    mocks.toastSuccess.mockReset();
  });

  it('handles a published terminal snapshot delivered before subscribe resolves exactly once', async () => {
    const unsubscribe = vi.fn();
    mocks.subscribe.mockImplementation(async (_id: string, listener: (value: OperationSnapshot) => void) => {
      listener(operation('succeeded'));
      return unsubscribe;
    });

    const rendered = renderImportPage();
    await screen.findByText('Characterized Pack');
    fireEvent.click(screen.getByRole('button', { name: 'modpacks.import' }));

    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledTimes(1));
    expect(mocks.toastSuccess).toHaveBeenCalledTimes(1);
    expect(unsubscribe).toHaveBeenCalledTimes(1);

    rendered.unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('releases a subscription that resolves after its route surface unmounts', async () => {
    const unsubscribe = vi.fn();
    let resolveSubscription: ((release: () => void) => void) | undefined;
    mocks.subscribe.mockImplementation(() => new Promise<() => void>((resolve) => {
      resolveSubscription = resolve;
    }));

    const rendered = renderImportPage();
    await screen.findByText('Characterized Pack');
    fireEvent.click(screen.getByRole('button', { name: 'modpacks.import' }));
    await waitFor(() => expect(mocks.subscribe).toHaveBeenCalledWith(operationId, expect.any(Function)));

    rendered.unmount();
    await act(async () => resolveSubscription?.(unsubscribe));

    await waitFor(() => expect(unsubscribe).toHaveBeenCalledTimes(1));
    expect(mocks.refresh).not.toHaveBeenCalled();
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
  });

  it('keeps degraded and recovery-required states truthful across existing status views', () => {
    const t = (key: string) => key;
    render(
      <>
        <OperationStatusView snapshot={operation('degraded')} t={t} testId="import-operation-status" />
        <OperationStatusView snapshot={operation('recovery-required', 'export')} t={t} testId="export-operation-status" />
        <OperationStatusView snapshot={operation('recovery-required', 'install-modrinth')} t={t} testId="provider-install-operation" />
      </>,
    );

    expect(screen.getByTestId('import-operation-status').getAttribute('data-operation-status')).toBe('degraded');
    expect(screen.getByTestId('export-operation-status').getAttribute('data-operation-status')).toBe('recovery-required');
    expect(screen.getByTestId('provider-install-operation').getAttribute('data-operation-status')).toBe('recovery-required');
    expect(screen.getAllByRole('alert')).toHaveLength(2);
  });
});
