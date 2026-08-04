import { useCallback, useEffect, useRef } from 'react';
import type { MutableRefObject } from 'react';
import {
  createModpack as createModpackSvc,
  renameModpack as renameModpackSvc,
  setSelectedModpackId,
} from '../services/instancesService';
import {
  useOperationSession,
  type OperationTerminalEvent,
} from '../../../features/operations/hooks/useOperationSession';

type PendingOperation = {
  resolve: (event: OperationTerminalEvent | null) => void;
  reject: (error: unknown) => void;
};

function settlePending(
  pendingRef: MutableRefObject<PendingOperation | null>,
  event: OperationTerminalEvent | null,
  error?: unknown,
) {
  const pending = pendingRef.current;
  pendingRef.current = null;
  if (!pending) return;
  if (error !== undefined) pending.reject(error);
  else pending.resolve(event);
}

export function useInstanceCrudActions(params: {
  invalidateInstances: () => Promise<void>;
}) {
  const { invalidateInstances } = params;
  const duplicatePendingRef = useRef<PendingOperation | null>(null);
  const deletePendingRef = useRef<PendingOperation | null>(null);

  useEffect(() => () => {
    settlePending(duplicatePendingRef, null);
    settlePending(deletePendingRef, null);
  }, []);

  const select = useCallback(
    async (id: string) => {
      await setSelectedModpackId(id);
      await invalidateInstances();
    },
    [invalidateInstances],
  );

  const create = useCallback(
    async (name: string) => {
      const created = await createModpackSvc(name);
      if (created?.id) {
        await select(created.id);
      } else {
        await invalidateInstances();
      }
    },
    [invalidateInstances, select],
  );

  const rename = useCallback(
    async (id: string, name: string) => {
      await renameModpackSvc(id, name);
      await invalidateInstances();
    },
    [invalidateInstances],
  );

  const handleDuplicateCommit = useCallback(async ({ classification }: OperationTerminalEvent) => {
    if (classification.selectableInstanceId) {
      await select(classification.selectableInstanceId);
    } else if (classification.shouldInvalidateInstances) {
      await invalidateInstances();
    }
  }, [invalidateInstances, select]);

  const duplicateSession = useOperationSession({
    onCommitted: handleDuplicateCommit,
    onTerminal: (event) => settlePending(duplicatePendingRef, event),
    onError: (error) => settlePending(duplicatePendingRef, null, error),
  });

  const deleteSession = useOperationSession({
    onCommitted: async ({ classification }) => {
      if (classification.shouldInvalidateInstances) await invalidateInstances();
    },
    onTerminal: (event) => settlePending(deletePendingRef, event),
    onError: (error) => settlePending(deletePendingRef, null, error),
  });
  const {
    isActive: isDuplicateActive,
    isStarting: isDuplicateStarting,
    start: startDuplicate,
  } = duplicateSession;
  const {
    isActive: isDeleteActive,
    isStarting: isDeleteStarting,
    start: startDelete,
  } = deleteSession;

  const duplicate = useCallback(async (sourceId: string, name?: string) => {
    if (duplicatePendingRef.current || isDuplicateActive || isDuplicateStarting) {
      throw new Error('A duplicate operation is already active');
    }

    const terminal = new Promise<OperationTerminalEvent | null>((resolve, reject) => {
      duplicatePendingRef.current = { resolve, reject };
    });
    await startDuplicate({ kind: 'duplicate', sourceId, name });
    return await terminal;
  }, [isDuplicateActive, isDuplicateStarting, startDuplicate]);

  const remove = useCallback(async (id: string) => {
    if (deletePendingRef.current || isDeleteActive || isDeleteStarting) {
      throw new Error('A delete operation is already active');
    }

    const terminal = new Promise<OperationTerminalEvent | null>((resolve, reject) => {
      deletePendingRef.current = { resolve, reject };
    });
    await startDelete({ kind: 'delete', instanceId: id });
    return await terminal;
  }, [isDeleteActive, isDeleteStarting, startDelete]);

  return {
    select,
    create,
    rename,
    duplicate,
    duplicateOperation: duplicateSession.snapshot,
    duplicateOperationError: duplicateSession.error,
    cancelDuplicate: duplicateSession.cancel,
    retryDuplicate: duplicateSession.retry,
    remove,
    deleteOperation: deleteSession.snapshot,
    deleteOperationError: deleteSession.error,
    cancelDelete: deleteSession.cancel,
    retryDelete: deleteSession.retry,
  };
}
