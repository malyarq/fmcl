import { useCallback, useEffect, useRef, useState } from 'react';
import type { OperationSnapshot, OperationStartRequest } from '@shared/contracts';
import { operationsIPC } from '../../services/ipc/operationsIPC';

type ProviderInstallRequest = Extract<OperationStartRequest, {
  kind: 'install-curseforge' | 'install-modrinth';
}>;

export function useProviderInstallOperation(enabled = true) {
  const [operation, setOperation] = useState<OperationSnapshot | null>(null);
  const [error, setError] = useState<unknown>(null);
  const mountedRef = useRef(true);
  const releaseRef = useRef<(() => void) | null>(null);
  const startingRef = useRef(false);
  const cancellingRef = useRef(false);

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

  const start = useCallback(async (input: ProviderInstallRequest) => {
    if (!enabled || startingRef.current || (operation && !isProviderInstallTerminal(operation))) return;
    startingRef.current = true;
    cancellingRef.current = false;
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
        if (!isProviderInstallTerminal(snapshot)) return;
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

  const cancel = useCallback(async () => {
    if (!operation || isProviderInstallTerminal(operation) || operation.status === 'cancelling' || cancellingRef.current) return;
    cancellingRef.current = true;
    try {
      await operationsIPC.cancel(operation.id);
    } catch (nextError) {
      cancellingRef.current = false;
      if (mountedRef.current) setError(nextError);
    }
  }, [operation]);

  return {
    operation,
    error,
    isActive: Boolean(operation && !isProviderInstallTerminal(operation)),
    start,
    cancel,
  };
}

export function isProviderInstallTerminal(snapshot: OperationSnapshot): boolean {
  return ['succeeded', 'recovered', 'degraded', 'cancelled', 'failed', 'recovery-required'].includes(snapshot.status);
}

export function isPublishedProviderInstall(snapshot: OperationSnapshot): boolean {
  return ['succeeded', 'recovered', 'degraded'].includes(snapshot.status)
    && snapshot.result?.status === snapshot.status;
}

export function hasPublishedProviderInstance(snapshot: OperationSnapshot): snapshot is OperationSnapshot & {
  status: 'succeeded' | 'recovered' | 'degraded';
  result: { status: 'succeeded' | 'recovered' | 'degraded'; instanceId: string };
} {
  return (snapshot.status === 'succeeded' || snapshot.status === 'recovered' || snapshot.status === 'degraded')
    && snapshot.result?.status === snapshot.status
    && 'instanceId' in snapshot.result
    && 'instanceId' in snapshot.result && Boolean(snapshot.result.instanceId);
}
