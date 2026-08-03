import { useCallback, useEffect, useRef, useState } from 'react';
import type { OperationSnapshot, OperationStartRequest } from '@shared/contracts';
import { operationsIPC } from '../../services/ipc/operationsIPC';

type ArchiveExportRequest = Extract<OperationStartRequest, { kind: 'export' }>;

export function useArchiveExportOperation(enabled = true) {
  const [operation, setOperation] = useState<OperationSnapshot | null>(null);
  const [error, setError] = useState<unknown>(null);
  const mountedRef = useRef(true);
  const releaseRef = useRef<(() => void) | null>(null);
  const startingRef = useRef(false);

  useEffect(() => {
    mountedRef.current = enabled;
    if (!enabled) {
      releaseRef.current?.();
      releaseRef.current = null;
    }
    return () => {
      mountedRef.current = false;
      releaseRef.current?.();
      releaseRef.current = null;
    };
  }, [enabled]);

  const start = useCallback(async (input: ArchiveExportRequest) => {
    if (!enabled || startingRef.current || (operation && !isArchiveExportTerminal(operation))) return;
    startingRef.current = true;
    setError(null);
    try {
      const started = await operationsIPC.start(input);
      if (!mountedRef.current) return;
      setOperation(started);
      let unsubscribe: (() => void) | null = null;
      let terminal: OperationSnapshot | null = null;
      let released = false;
      const release = () => {
        if (released) return;
        released = true;
        unsubscribe?.();
        if (releaseRef.current === release) releaseRef.current = null;
      };
      const onSnapshot = (snapshot: OperationSnapshot) => {
        if (!mountedRef.current) return;
        setOperation(snapshot);
        if (!isArchiveExportTerminal(snapshot)) return;
        terminal = snapshot;
        if (unsubscribe) release();
      };
      void operationsIPC.subscribe(started.id, onSnapshot).then((nextUnsubscribe) => {
        unsubscribe = nextUnsubscribe;
        startingRef.current = false;
        if (!mountedRef.current) {
          release();
          return;
        }
        releaseRef.current?.();
        releaseRef.current = release;
        if (terminal) release();
      }, (nextError) => {
        startingRef.current = false;
        if (mountedRef.current) setError(nextError);
      });
    } catch (nextError) {
      if (mountedRef.current) setError(nextError);
      startingRef.current = false;
    } finally {
      if (!mountedRef.current) startingRef.current = false;
    }
  }, [enabled, operation]);

  return { operation, error, isActive: Boolean(operation && !isArchiveExportTerminal(operation)), start };
}

export function isArchiveExportTerminal(snapshot: OperationSnapshot): boolean {
  return ['succeeded', 'recovered', 'degraded', 'cancelled', 'failed', 'recovery-required'].includes(snapshot.status);
}

export function isArchiveExportSuccessful(snapshot: OperationSnapshot): boolean {
  return (snapshot.status === 'succeeded' || snapshot.status === 'recovered')
    && snapshot.result?.status === snapshot.status;
}
