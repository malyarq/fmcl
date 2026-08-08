// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OperationSnapshot } from '@shared/contracts';
import { ShareModal } from '../ShareModal';
import { ImportShareModal } from '../ImportShareModal';
import { createTranslator } from '../../../contexts/settings/i18n';

const generateCodeMock = vi.fn();
const toastErrorMock = vi.fn();
const toastSuccessMock = vi.fn();
const writeTextMock = vi.fn();
const t = createTranslator('en');

vi.mock('../../../contexts/SettingsContext', () => ({
  useSettings: () => ({
    t,
  }),
}));

vi.mock('../../../contexts/ToastContext', () => ({
  useToast: () => ({
    showToast: vi.fn(),
    success: (...args: unknown[]) => toastSuccessMock(...args),
    error: (...args: unknown[]) => toastErrorMock(...args),
    warning: vi.fn(),
    info: vi.fn(),
  }),
}));

const startMock = vi.fn();
const subscribeMock = vi.fn();
const cancelMock = vi.fn();
vi.mock('../../../services/ipc/shareIPC', () => ({
  shareIPC: {
    generateCode: (...args: unknown[]) => generateCodeMock(...args),
  },
}));

vi.mock('../../../services/ipc/operationsIPC', () => ({
  operationsIPC: {
    start: (...args: unknown[]) => startMock(...args),
    subscribe: (...args: unknown[]) => subscribeMock(...args),
    cancel: (...args: unknown[]) => cancelMock(...args),
  },
}));

function mockMatchMedia(matches = false) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
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

describe('share flows', () => {
  beforeEach(() => {
    cleanup();
    mockMatchMedia(false);
    generateCodeMock.mockReset();
    startMock.mockReset();
    subscribeMock.mockReset();
    cancelMock.mockReset().mockResolvedValue({ cancelled: true });
    toastErrorMock.mockReset();
    toastSuccessMock.mockReset();
    writeTextMock.mockReset();

    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: (...args: unknown[]) => writeTextMock(...args),
      },
    });
  });

  it('loads a share code into the shared dialog surface and copies it to the clipboard', async () => {
    generateCodeMock.mockResolvedValue('burrow://share/alpha-pack');

    render(<ShareModal isOpen={true} onClose={vi.fn()} modpackId="alpha-pack" />);

    expect(await screen.findByRole('dialog', { name: 'Share Modpack' })).toBeTruthy();
    expect(await screen.findByDisplayValue('burrow://share/alpha-pack')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Copy Code' }));

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith('burrow://share/alpha-pack');
    });

    expect(await screen.findByRole('button', { name: 'Copied!' })).toBeTruthy();
  });

  it('surfaces share-generation failures inline instead of falling back to browser errors', async () => {
    generateCodeMock.mockRejectedValue(new Error('[shareIPC] generateCode failed: ${file.jarVersion}'));

    render(<ShareModal isOpen={true} onClose={vi.fn()} modpackId="broken-pack" />);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Failed to generate a share code.');
    expect(alert.textContent).not.toContain('generateCode failed');
    expect(alert.textContent).not.toContain('${file.jarVersion}');

    generateCodeMock.mockResolvedValue('burrow://share/recovered-pack');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByDisplayValue('burrow://share/recovered-pack')).toBeTruthy();
  });

  it('keeps import disabled until a code is provided and forwards only the share code to the operation owner', async () => {
    const onCommittedMock = vi.fn().mockResolvedValue(undefined);
    const onCloseMock = vi.fn();
    const release = vi.fn();
    startMock.mockResolvedValue(shareSnapshot('queued'));
    subscribeMock.mockImplementation(async (_id: string, listener: (snapshot: OperationSnapshot) => void) => {
      listener(shareSnapshot('succeeded'));
      return release;
    });

    render(<ImportShareModal isOpen={true} onClose={onCloseMock} onCommitted={onCommittedMock} />);

    const importButton = screen.getByRole('button', { name: 'Import' });
    expect(importButton.getAttribute('disabled')).not.toBeNull();

    fireEvent.change(screen.getByRole('textbox', { name: 'Paste burrow://share/... code here' }), {
      target: { value: 'burrow://share/alpha-pack' },
    });

    expect(screen.getByRole('button', { name: 'Import' }).getAttribute('disabled')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Import' }));

    await waitFor(() => {
      expect(startMock).toHaveBeenCalledWith({ kind: 'import-share', code: 'burrow://share/alpha-pack' });
    });

    await waitFor(() => expect(onCommittedMock).toHaveBeenCalledTimes(1));
    expect(toastSuccessMock).toHaveBeenCalledWith('Modpack imported successfully.');
    expect(onCloseMock).toHaveBeenCalledTimes(1);
    expect(release).toHaveBeenCalledTimes(1);
  });

  it('sanitizes import wrapper failures before showing them inline', async () => {
    const onCommittedMock = vi.fn();
    startMock.mockRejectedValue(new Error('[operationsIPC] start failed: ${file.jarVersion}'));

    render(<ImportShareModal isOpen={true} onClose={vi.fn()} onCommitted={onCommittedMock} />);

    fireEvent.change(screen.getByRole('textbox', { name: 'Paste burrow://share/... code here' }), {
      target: { value: 'burrow://share/broken-pack' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Import' }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Failed to import the modpack. The code may be invalid or incomplete.');
    expect(alert.textContent).not.toContain('start failed');
    expect(alert.textContent).not.toContain('${file.jarVersion}');
    expect(onCommittedMock).not.toHaveBeenCalled();
    expect(toastSuccessMock).not.toHaveBeenCalled();
  });

  it('invalidates degraded share publication but keeps recovery visible without a success toast', async () => {
    const onCommittedMock = vi.fn().mockResolvedValue(undefined);
    const onCloseMock = vi.fn();
    let listener: ((snapshot: OperationSnapshot) => void) | undefined;
    startMock.mockResolvedValue(shareSnapshot('queued'));
    subscribeMock.mockImplementation(async (_id: string, nextListener: (snapshot: OperationSnapshot) => void) => {
      listener = nextListener;
      return vi.fn();
    });

    render(<ImportShareModal isOpen={true} onClose={onCloseMock} onCommitted={onCommittedMock} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Paste burrow://share/... code here' }), {
      target: { value: 'burrow://share/partial-pack' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Import' }));
    await waitFor(() => expect(listener).toBeTypeOf('function'));
    act(() => listener?.(shareSnapshot('degraded')));

    await waitFor(() => expect(onCommittedMock).toHaveBeenCalledTimes(1));
    const status = screen.getByTestId('share-import-operation-status');
    expect(status.getAttribute('data-operation-status')).toBe('degraded');
    expect(status.getAttribute('data-presentation-success')).toBe('false');
    expect(status.textContent).toContain('optional.jar');
    expect(toastSuccessMock).not.toHaveBeenCalled();
    expect(onCloseMock).not.toHaveBeenCalled();
  });

  it('keeps recovery-required share import actionable without invalidation or success', async () => {
    const onCommittedMock = vi.fn();
    const onCloseMock = vi.fn();
    let listener: ((snapshot: OperationSnapshot) => void) | undefined;
    startMock.mockResolvedValue(shareSnapshot('queued'));
    subscribeMock.mockImplementation(async (_id: string, nextListener: (snapshot: OperationSnapshot) => void) => {
      listener = nextListener;
      return vi.fn();
    });

    render(<ImportShareModal isOpen={true} onClose={onCloseMock} onCommitted={onCommittedMock} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Paste burrow://share/... code here' }), {
      target: { value: 'burrow://share/recovery-pack' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Import' }));
    await waitFor(() => expect(listener).toBeTypeOf('function'));
    act(() => listener?.(shareSnapshot('recovery-required')));

    const alert = await screen.findByRole('alert');
    expect(alert.getAttribute('data-operation-status')).toBe('recovery-required');
    expect(alert.textContent).toContain('Restore the staged import before retrying');
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
    expect(onCommittedMock).not.toHaveBeenCalled();
    expect(toastSuccessMock).not.toHaveBeenCalled();
    expect(onCloseMock).not.toHaveBeenCalled();
  });
});

function shareSnapshot(status: OperationSnapshot['status']): OperationSnapshot {
  return {
    id: 'share-operation',
    kind: 'import-share',
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
    result: status === 'succeeded'
      ? { status, instanceId: 'imported-pack' }
      : status === 'degraded'
        ? { status, instanceId: 'imported-pack', missing: ['optional.jar'] }
        : status === 'recovery-required'
          ? { status, message: 'Restore the staged import before retrying' }
        : undefined,
  };
}
