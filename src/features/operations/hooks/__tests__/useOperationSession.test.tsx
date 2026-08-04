// @vitest-environment jsdom

import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OperationSnapshot, OperationStatus } from '@shared/contracts';
import { useOperationSession } from '../useOperationSession';

const ipc = vi.hoisted(() => ({
  start: vi.fn(),
  cancel: vi.fn(),
  subscribe: vi.fn(),
}));

vi.mock('../../../../services/ipc/operationsIPC', () => ({ operationsIPC: ipc }));

function operation(status: OperationStatus): OperationSnapshot {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    kind: 'import',
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
      ? { status, instanceId: 'published-instance' }
      : status === 'degraded'
        ? { status, instanceId: 'published-instance', missing: ['optional.jar'] }
        : status === 'cancelled'
          ? { status }
          : undefined,
  };
}

describe('useOperationSession', () => {
  beforeEach(() => {
    ipc.start.mockReset();
    ipc.cancel.mockReset().mockResolvedValue({ cancelled: true });
    ipc.subscribe.mockReset();
  });

  it('classifies a terminal start result without subscribing and commits exactly once', async () => {
    const onCommitted = vi.fn();
    const onTerminal = vi.fn();
    ipc.start.mockResolvedValue(operation('succeeded'));

    const { result } = renderHook(() => useOperationSession({ onCommitted, onTerminal }));
    await act(async () => result.current.start({ kind: 'import', archiveRef: 'archive-ref' }));

    expect(ipc.subscribe).not.toHaveBeenCalled();
    expect(onCommitted).toHaveBeenCalledTimes(1);
    expect(onTerminal).toHaveBeenCalledTimes(1);
    expect(onCommitted.mock.calls[0][0].classification).toMatchObject({
      didCommit: true,
      isPresentationSuccess: true,
      selectableInstanceId: 'published-instance',
    });
    expect(result.current.snapshot?.status).toBe('succeeded');
  });

  it('handles a terminal callback before subscribe resolves and releases exactly once', async () => {
    const release = vi.fn();
    const onCommitted = vi.fn();
    const onTerminal = vi.fn();
    let emit: ((value: OperationSnapshot) => void) | undefined;
    ipc.start.mockResolvedValue(operation('queued'));
    ipc.subscribe.mockImplementation(async (_id: string, listener: (value: OperationSnapshot) => void) => {
      emit = listener;
      listener(operation('degraded'));
      return release;
    });

    const { result, unmount } = renderHook(() => useOperationSession({ onCommitted, onTerminal }));
    await act(async () => result.current.start({ kind: 'import', archiveRef: 'archive-ref' }));

    await waitFor(() => expect(release).toHaveBeenCalledTimes(1));
    expect(onCommitted).toHaveBeenCalledTimes(1);
    expect(onCommitted.mock.calls[0][0].classification).toMatchObject({
      didCommit: true,
      isPresentationSuccess: false,
      mayCloseSurface: false,
    });
    expect(onTerminal).toHaveBeenCalledTimes(1);

    act(() => emit?.(operation('succeeded')));
    unmount();
    expect(release).toHaveBeenCalledTimes(1);
    expect(onCommitted).toHaveBeenCalledTimes(1);
    expect(onTerminal).toHaveBeenCalledTimes(1);
  });

  it('releases a subscription that resolves after unmount without publishing callbacks', async () => {
    const release = vi.fn();
    const onCommitted = vi.fn();
    const onTerminal = vi.fn();
    let resolveSubscription: ((value: () => void) => void) | undefined;
    ipc.start.mockResolvedValue(operation('queued'));
    ipc.subscribe.mockImplementation(() => new Promise<() => void>((resolve) => {
      resolveSubscription = resolve;
    }));

    const { result, unmount } = renderHook(() => useOperationSession({ onCommitted, onTerminal }));
    await act(async () => result.current.start({ kind: 'import', archiveRef: 'archive-ref' }));
    await waitFor(() => expect(ipc.subscribe).toHaveBeenCalledTimes(1));

    unmount();
    await act(async () => resolveSubscription?.(release));

    expect(release).toHaveBeenCalledTimes(1);
    expect(onCommitted).not.toHaveBeenCalled();
    expect(onTerminal).not.toHaveBeenCalled();
  });

  it('reports cancelled terminal state without claiming a commit', async () => {
    const onCommitted = vi.fn();
    const onTerminal = vi.fn();
    ipc.start.mockResolvedValue(operation('cancelled'));

    const { result } = renderHook(() => useOperationSession({ onCommitted, onTerminal }));
    await act(async () => result.current.start({ kind: 'import', archiveRef: 'archive-ref' }));

    expect(onCommitted).not.toHaveBeenCalled();
    expect(onTerminal).toHaveBeenCalledTimes(1);
    expect(onTerminal.mock.calls[0][0].classification.didCommit).toBe(false);
  });

  it('cancels an active operation and reset releases and clears the session', async () => {
    const release = vi.fn();
    ipc.start.mockResolvedValue(operation('queued'));
    ipc.subscribe.mockResolvedValue(release);

    const { result } = renderHook(() => useOperationSession());
    await act(async () => result.current.start({ kind: 'import', archiveRef: 'archive-ref' }));
    await waitFor(() => expect(result.current.isActive).toBe(true));

    await act(async () => result.current.cancel());
    expect(ipc.cancel).toHaveBeenCalledWith('11111111-1111-1111-1111-111111111111');

    act(() => result.current.reset());
    expect(release).toHaveBeenCalledTimes(1);
    expect(result.current.snapshot).toBeNull();
    expect(result.current.classification).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('retries the owned request after a start error', async () => {
    const onCommitted = vi.fn();
    ipc.start
      .mockRejectedValueOnce(new Error('Main process unavailable'))
      .mockResolvedValueOnce(operation('succeeded'));

    const { result } = renderHook(() => useOperationSession({ onCommitted }));
    await act(async () => result.current.start({ kind: 'import', archiveRef: 'archive-ref' }));
    expect(result.current.error).toEqual(new Error('Main process unavailable'));

    await act(async () => result.current.retry());
    expect(ipc.start).toHaveBeenCalledTimes(2);
    expect(result.current.error).toBeNull();
    expect(result.current.snapshot?.status).toBe('succeeded');
    expect(onCommitted).toHaveBeenCalledTimes(1);
  });

  it('runs terminal presentation only after the committed effect settles', async () => {
    let resolveCommit: (() => void) | undefined;
    const onCommitted = vi.fn(() => new Promise<void>((resolve) => {
      resolveCommit = resolve;
    }));
    const onTerminal = vi.fn();
    ipc.start.mockResolvedValue(operation('succeeded'));

    const { result } = renderHook(() => useOperationSession({ onCommitted, onTerminal }));
    await act(async () => result.current.start({ kind: 'import', archiveRef: 'archive-ref' }));

    expect(onCommitted).toHaveBeenCalledTimes(1);
    expect(onTerminal).not.toHaveBeenCalled();

    await act(async () => resolveCommit?.());
    await waitFor(() => expect(onTerminal).toHaveBeenCalledTimes(1));
  });

  it('suppresses success presentation when the committed effect fails', async () => {
    const failure = new Error('Canonical invalidation failed');
    const onError = vi.fn();
    const onTerminal = vi.fn();
    ipc.start.mockResolvedValue(operation('succeeded'));

    const { result } = renderHook(() => useOperationSession({
      onCommitted: async () => { throw failure; },
      onTerminal,
      onError,
    }));
    await act(async () => result.current.start({ kind: 'import', archiveRef: 'archive-ref' }));

    await waitFor(() => expect(onError).toHaveBeenCalledWith(failure));
    expect(onTerminal).not.toHaveBeenCalled();
    expect(result.current.error).toBe(failure);
  });
});
