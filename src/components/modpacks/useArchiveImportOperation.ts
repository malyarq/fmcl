import { useCallback, useEffect, useRef, useState } from 'react';
import type { OperationSnapshot } from '@shared/contracts';
import { operationsIPC } from '../../services/ipc/operationsIPC';

type ArchiveImportOperationOptions = {
  filePath: string;
  enabled?: boolean;
  onPublished: () => Promise<void> | void;
};

export function useArchiveImportOperation({ filePath, enabled = true, onPublished }: ArchiveImportOperationOptions) {
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
      return;
    }
    return () => {
      mountedRef.current = false;
      releaseRef.current?.();
      releaseRef.current = null;
    };
  }, [enabled, filePath]);

  const start = useCallback(async () => {
    if (!enabled || startingRef.current || (operation && !isTerminal(operation))) return;
    startingRef.current = true;
    setError(null);

    try {
      const started = await operationsIPC.start({ kind: 'import', filePath });
      if (!mountedRef.current) {
        startingRef.current = false;
        return;
      }
      setOperation(started);

      let unsubscribe: (() => void) | null = null;
      let terminal: OperationSnapshot | null = null;
      let released = false;
      let completed = false;

      const release = () => {
        if (released) return;
        released = true;
        unsubscribe?.();
        if (releaseRef.current === release) releaseRef.current = null;
      };

      const complete = (snapshot: OperationSnapshot) => {
        if (completed) return;
        completed = true;
        release();
        if (isPublished(snapshot)) {
          void Promise.resolve(onPublished()).catch((nextError) => {
            if (mountedRef.current) setError(nextError);
          });
        }
      };

      const onSnapshot = (snapshot: OperationSnapshot) => {
        if (!mountedRef.current) return;
        setOperation(snapshot);
        if (!isTerminal(snapshot)) return;
        terminal = snapshot;
        if (unsubscribe) complete(snapshot);
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
        if (terminal) complete(terminal);
      }, (nextError) => {
        startingRef.current = false;
        if (mountedRef.current) setError(nextError);
      });
    } catch (nextError) {
      if (mountedRef.current) setError(nextError);
      startingRef.current = false;
    }
  }, [enabled, filePath, onPublished, operation]);

  return {
    operation,
    error,
    isActive: Boolean(operation && !isTerminal(operation)),
    start,
  };
}

export function isTerminal(snapshot: OperationSnapshot): boolean {
  return ['succeeded', 'recovered', 'degraded', 'cancelled', 'failed', 'recovery-required'].includes(snapshot.status);
}

export function isPublished(snapshot: OperationSnapshot): boolean {
  return (snapshot.status === 'succeeded' || snapshot.status === 'recovered' || snapshot.status === 'degraded')
    && snapshot.result?.status === snapshot.status
    && 'instanceId' in snapshot.result
    && Boolean(snapshot.result.instanceId);
}
