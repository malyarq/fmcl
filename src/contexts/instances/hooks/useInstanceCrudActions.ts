import { useCallback, useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { OperationSnapshot } from '@shared/contracts';
import type { ModpackConfig } from '../types';
import {
  createModpack as createModpackSvc,
  fetchModpackConfig,
  renameModpack as renameModpackSvc,
  setSelectedModpackId,
} from '../services/instancesService';
import { operationsIPC } from '../../../services/ipc/operationsIPC';

export function useInstanceCrudActions(params: {
  rootPath?: string;
  selectedId: string;
  setSelectedId: (id: string) => void;
  setConfig: Dispatch<SetStateAction<ModpackConfig | null>>;
  refresh: () => Promise<void>;
  loadSelected: () => Promise<void>;
}) {
  const { rootPath, selectedId, setSelectedId, setConfig, refresh, loadSelected } = params;
  const [duplicateOperation, setDuplicateOperation] = useState<OperationSnapshot | null>(null);
  const [deleteOperation, setDeleteOperation] = useState<OperationSnapshot | null>(null);
  const unsubscribeDuplicateRef = useRef<(() => void) | null>(null);
  const unsubscribeDeleteRef = useRef<(() => void) | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      unsubscribeDuplicateRef.current?.();
      unsubscribeDuplicateRef.current = null;
      unsubscribeDeleteRef.current?.();
      unsubscribeDeleteRef.current = null;
    };
  }, []);

  const select = useCallback(
    async (id: string) => {
      await setSelectedModpackId(id, rootPath);
      setSelectedId(id);
      const cfg = await fetchModpackConfig(id, rootPath);
      setConfig(cfg);
      await refresh();
    },
    [refresh, rootPath, setConfig, setSelectedId]
  );

  const create = useCallback(
    async (name: string) => {
      const created = await createModpackSvc(name, rootPath);
      if (created?.id) {
        await select(created.id);
      } else {
        await refresh();
        await loadSelected();
      }
    },
    [loadSelected, refresh, rootPath, select]
  );

  const rename = useCallback(
    async (id: string, name: string) => {
      await renameModpackSvc(id, name, rootPath);
      await refresh();
      if (id === selectedId) {
        const cfg = await fetchModpackConfig(id, rootPath);
        setConfig(cfg);
      }
    },
    [refresh, rootPath, selectedId, setConfig]
  );

  const duplicate = useCallback(
    async (sourceId: string, name?: string) => {
      const started = await operationsIPC.start({ kind: 'duplicate', rootPath, sourceId, name });
      setDuplicateOperation(started);

      await new Promise<void>((resolve, reject) => {
        let terminal: OperationSnapshot | null = null;
        let released = false;
        let unsubscribe: (() => void) | null = null;
        let completed = false;

        const release = () => {
          if (released) return;
          released = true;
          unsubscribe?.();
          if (unsubscribeDuplicateRef.current === release) unsubscribeDuplicateRef.current = null;
        };

        const complete = async (snapshot: OperationSnapshot) => {
          if (completed) return;
          completed = true;
          release();
          try {
            if (hasPublishedDuplicate(snapshot)) await select(snapshot.result.instanceId);
            resolve();
          } catch (error) {
            reject(error);
          }
        };

        const onSnapshot = (snapshot: OperationSnapshot) => {
          setDuplicateOperation(snapshot);
          if (!isTerminal(snapshot)) return;
          terminal = snapshot;
          if (unsubscribe) void complete(snapshot);
        };

        void operationsIPC.subscribe(started.id, onSnapshot).then((nextUnsubscribe) => {
          unsubscribe = nextUnsubscribe;
          if (!isMountedRef.current) {
            nextUnsubscribe();
            return;
          }
          unsubscribeDuplicateRef.current?.();
          unsubscribeDuplicateRef.current = release;
          if (terminal) void complete(terminal);
        }, reject);
      });
    },
    [rootPath, select]
  );

  const remove = useCallback(
    async (id: string) => {
      const started = await operationsIPC.start({ kind: 'delete', rootPath, instanceId: id });
      setDeleteOperation(started);

      await new Promise<void>((resolve, reject) => {
        let terminal: OperationSnapshot | null = null;
        let released = false;
        let unsubscribe: (() => void) | null = null;
        let completed = false;
        const release = () => {
          if (released) return;
          released = true;
          unsubscribe?.();
          if (unsubscribeDeleteRef.current === release) unsubscribeDeleteRef.current = null;
        };
        const complete = async (snapshot: OperationSnapshot) => {
          if (completed) return;
          completed = true;
          release();
          try {
            if (hasCommittedDelete(snapshot)) {
              await refresh();
              await loadSelected();
            }
            resolve();
          } catch (error) {
            reject(error);
          }
        };
        const onSnapshot = (snapshot: OperationSnapshot) => {
          setDeleteOperation(snapshot);
          if (!isTerminal(snapshot)) return;
          terminal = snapshot;
          if (unsubscribe) void complete(snapshot);
        };
        void operationsIPC.subscribe(started.id, onSnapshot).then((nextUnsubscribe) => {
          unsubscribe = nextUnsubscribe;
          if (!isMountedRef.current) {
            nextUnsubscribe();
            return;
          }
          unsubscribeDeleteRef.current?.();
          unsubscribeDeleteRef.current = release;
          if (terminal) void complete(terminal);
        }, reject);
      });
    },
    [loadSelected, refresh, rootPath]
  );

  return { select, create, rename, duplicate, duplicateOperation, remove, deleteOperation };
}

function hasPublishedDuplicate(snapshot: OperationSnapshot): snapshot is OperationSnapshot & {
  status: 'succeeded' | 'recovered';
  result: { status: 'succeeded' | 'recovered'; instanceId: string };
} {
  return (snapshot.status === 'succeeded' || snapshot.status === 'recovered')
    && snapshot.result?.status === snapshot.status
    && 'instanceId' in snapshot.result
    && Boolean(snapshot.result.instanceId);
}

function hasCommittedDelete(snapshot: OperationSnapshot): snapshot is OperationSnapshot & {
  status: 'succeeded' | 'recovered';
  result: { status: 'succeeded' | 'recovered'; instanceId?: string };
} {
  return (snapshot.status === 'succeeded' || snapshot.status === 'recovered')
    && snapshot.result?.status === snapshot.status;
}

function isTerminal(snapshot: OperationSnapshot): boolean {
  return ['succeeded', 'recovered', 'degraded', 'cancelled', 'failed', 'recovery-required'].includes(snapshot.status);
}
