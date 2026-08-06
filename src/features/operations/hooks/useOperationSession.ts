import { useCallback, useEffect, useRef, useState } from 'react';
import type { OperationKind, OperationSnapshot, OperationStartRequest } from '@shared/contracts';
import { operationsIPC } from '../../../services/ipc/operationsIPC';
import {
  classifyOperationTerminal,
  type OperationTerminalClassification,
} from '../operationTerminalPolicy';
import { analyticsClient, type AnalyticsEventMap } from '../../analytics/analyticsClient';

export type OperationTerminalEvent = {
  snapshot: OperationSnapshot;
  classification: OperationTerminalClassification;
};

export type UseOperationSessionOptions = {
  enabled?: boolean;
  onCommitted?: (event: OperationTerminalEvent) => Promise<void> | void;
  onTerminal?: (event: OperationTerminalEvent) => Promise<void> | void;
  onError?: (error: unknown) => void;
};

type SessionRun = {
  generation: number;
  unsubscribe: (() => void) | null;
  releaseRequested: boolean;
  released: boolean;
  terminalHandled: boolean;
};

function toAnalyticsResult(status: OperationSnapshot['status']): 'succeeded' | 'recovered' | 'degraded' | 'cancelled' | 'failed' | 'recovery_required' | null {
  if (status === 'recovery-required') return 'recovery_required';
  if (status === 'succeeded' || status === 'recovered' || status === 'degraded' || status === 'cancelled' || status === 'failed') return status;
  return null;
}

const analyticsOperationKinds = {
  duplicate: 'duplicate',
  import: 'import',
  'import-share': 'import_share',
  'install-curseforge': 'install_curseforge',
  'install-modrinth': 'install_modrinth',
  update: 'update',
  delete: 'delete',
  export: 'export',
} satisfies Record<OperationKind, AnalyticsEventMap['operation_finished']['kind']>;

function releaseRun(run: SessionRun) {
  if (run.released) return;
  run.releaseRequested = true;
  if (!run.unsubscribe) return;

  const unsubscribe = run.unsubscribe;
  run.unsubscribe = null;
  run.released = true;
  unsubscribe();
}

export function useOperationSession({
  enabled = true,
  onCommitted,
  onTerminal,
  onError,
}: UseOperationSessionOptions = {}) {
  const [snapshot, setSnapshot] = useState<OperationSnapshot | null>(null);
  const [classification, setClassification] = useState<OperationTerminalClassification | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  const mountedRef = useRef(true);
  const generationRef = useRef(0);
  const activeRunRef = useRef<SessionRun | null>(null);
  const lastRequestRef = useRef<OperationStartRequest | null>(null);
  const startingRef = useRef(false);
  const onCommittedRef = useRef(onCommitted);
  const onTerminalRef = useRef(onTerminal);
  const onErrorRef = useRef(onError);
  onCommittedRef.current = onCommitted;
  onTerminalRef.current = onTerminal;
  onErrorRef.current = onError;

  const isCurrentRun = useCallback((run: SessionRun) => (
    mountedRef.current
    && enabled
    && activeRunRef.current === run
    && generationRef.current === run.generation
  ), [enabled]);

  const reportCallbackError = useCallback((run: SessionRun, nextError: unknown) => {
    if (!isCurrentRun(run)) return;
    setError(nextError);
    try {
      onErrorRef.current?.(nextError);
    } catch (notificationError) {
      console.error('Operation error callback failed:', notificationError);
    }
  }, [isCurrentRun]);

  const invokeTerminalCallback = useCallback((
    run: SessionRun,
    callback: ((event: OperationTerminalEvent) => Promise<void> | void) | undefined,
    event: OperationTerminalEvent,
  ): Promise<boolean> => {
    if (!callback) return Promise.resolve(true);
    try {
      return Promise.resolve(callback(event)).then(
        () => true,
        (nextError: unknown) => {
          reportCallbackError(run, nextError);
          return false;
        },
      );
    } catch (nextError) {
      reportCallbackError(run, nextError);
      return Promise.resolve(false);
    }
  }, [reportCallbackError]);

  const publishSnapshot = useCallback((run: SessionRun, nextSnapshot: OperationSnapshot) => {
    if (!isCurrentRun(run) || run.terminalHandled) return;

    const nextClassification = classifyOperationTerminal(nextSnapshot);
    setSnapshot(nextSnapshot);
    setClassification(nextClassification);
    if (!nextClassification.isTerminal) return;

    run.terminalHandled = true;
    releaseRun(run);
    const analyticsResult = toAnalyticsResult(nextSnapshot.status);
    const analyticsKind = analyticsOperationKinds[nextSnapshot.kind];
    if (analyticsResult) void analyticsClient.capture('operation_finished', { kind: analyticsKind, result: analyticsResult });
    const event = { snapshot: nextSnapshot, classification: nextClassification };
    if (nextClassification.didCommit) {
      const committedCallback = onCommittedRef.current;
      const terminalCallback = onTerminalRef.current;
      void invokeTerminalCallback(run, committedCallback, event).then((effectCompleted) => (
        effectCompleted ? invokeTerminalCallback(run, terminalCallback, event) : false
      ));
      return;
    }
    void invokeTerminalCallback(run, onTerminalRef.current, event);
  }, [invokeTerminalCallback, isCurrentRun]);

  const stopCurrentRun = useCallback(() => {
    generationRef.current += 1;
    const run = activeRunRef.current;
    activeRunRef.current = null;
    if (run) releaseRun(run);
    startingRef.current = false;
  }, []);

  const runRequest = useCallback(async (request: OperationStartRequest, replaceCurrent: boolean) => {
    if (!enabled || startingRef.current) return;
    if (!replaceCurrent && snapshot && !classification?.isTerminal) return;

    stopCurrentRun();
    const run: SessionRun = {
      generation: generationRef.current,
      unsubscribe: null,
      releaseRequested: false,
      released: false,
      terminalHandled: false,
    };
    activeRunRef.current = run;
    lastRequestRef.current = request;
    startingRef.current = true;
    setIsStarting(true);
    setIsCancelling(false);
    setSnapshot(null);
    setClassification(null);
    setError(null);

    let started: OperationSnapshot;
    try {
      started = await operationsIPC.start(request);
    } catch (nextError) {
      reportCallbackError(run, nextError);
      if (activeRunRef.current === run) {
        startingRef.current = false;
        setIsStarting(false);
      }
      releaseRun(run);
      return;
    }

    if (!isCurrentRun(run)) {
      releaseRun(run);
      return;
    }
    startingRef.current = false;
    setIsStarting(false);
    publishSnapshot(run, started);
    if (run.terminalHandled || !isCurrentRun(run)) return;

    void operationsIPC.subscribe(started.id, (nextSnapshot) => {
      publishSnapshot(run, nextSnapshot);
    }).then((unsubscribe) => {
      run.unsubscribe = unsubscribe;
      if (run.releaseRequested || !isCurrentRun(run)) releaseRun(run);
    }, (nextError: unknown) => {
      if (!run.terminalHandled) reportCallbackError(run, nextError);
      releaseRun(run);
    });
  }, [
    classification?.isTerminal,
    enabled,
    isCurrentRun,
    publishSnapshot,
    reportCallbackError,
    snapshot,
    stopCurrentRun,
  ]);

  const start = useCallback((request: OperationStartRequest) => (
    runRequest(request, false)
  ), [runRequest]);

  const retry = useCallback(async () => {
    const request = lastRequestRef.current;
    if (request) await runRequest(request, true);
  }, [runRequest]);

  const cancel = useCallback(async () => {
    const operationId = snapshot && !classification?.isTerminal ? snapshot.id : null;
    if (!enabled || !operationId || isCancelling) return;

    const generation = generationRef.current;
    setIsCancelling(true);
    setError(null);
    try {
      await operationsIPC.cancel(operationId);
    } catch (nextError) {
      const run = activeRunRef.current;
      if (run && mountedRef.current && generationRef.current === generation) {
        reportCallbackError(run, nextError);
      }
    } finally {
      if (mountedRef.current && generationRef.current === generation) setIsCancelling(false);
    }
  }, [classification?.isTerminal, enabled, isCancelling, reportCallbackError, snapshot]);

  const reset = useCallback(() => {
    stopCurrentRun();
    lastRequestRef.current = null;
    setSnapshot(null);
    setClassification(null);
    setError(null);
    setIsStarting(false);
    setIsCancelling(false);
  }, [stopCurrentRun]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopCurrentRun();
    };
  }, [stopCurrentRun]);

  useEffect(() => {
    if (!enabled) reset();
  }, [enabled, reset]);

  return {
    snapshot,
    classification,
    error,
    isActive: Boolean(snapshot && !classification?.isTerminal),
    isStarting,
    isCancelling,
    start,
    cancel,
    reset,
    retry,
  };
}
