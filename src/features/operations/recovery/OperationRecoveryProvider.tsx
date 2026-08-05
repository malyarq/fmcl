import type { OperationKind, OperationSnapshot } from '@shared/contracts';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useUIMode } from '../../../contexts/SettingsContext';
import { operationsIPC } from '../../../services/ipc/operationsIPC';
import { useInstanceInvalidation } from '../../instances/hooks/useInstanceInvalidation';
import { classifyOperationTerminal } from '../operationTerminalPolicy';
import { OperationRecoveryInbox } from './OperationRecoveryInbox';
import { getOperationRecoveryDestination } from './operationRecoveryPolicy';
import { OperationRecoveryContext } from './OperationRecoveryContext';
import {
  isRecoverySnapshot,
  normalizeRecoverySnapshots,
  readDismissedRecoveryIds,
  rememberDismissedRecoveryId,
  replaceRecoveryRecord,
} from './operationRecoveryRecords';

export function OperationRecoveryProvider({ children }: { children: ReactNode }) {
  const recoveryInboxEnabled = window.location.hash !== '#console';
  const { invalidateInstances } = useInstanceInvalidation();
  const { setMode } = useUIMode();
  const [records, setRecords] = useState<OperationSnapshot[]>([]);
  const [selected, setSelected] = useState<OperationSnapshot | null>(null);
  const [inspectingId, setInspectingId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<unknown | null>(null);
  const bootstrapPromiseRef = useRef<Promise<OperationSnapshot[]> | null>(null);
  const invalidatedOperationIdsRef = useRef(new Set<string>());
  const loadGenerationRef = useRef(0);
  const inspectGenerationRef = useRef(0);
  const mountedRef = useRef(true);
  const dismissedIdsRef = useRef(readDismissedRecoveryIds());

  const invalidateCommittedRecovery = useCallback(async (snapshot: OperationSnapshot) => {
    const classification = classifyOperationTerminal(snapshot);
    if (!classification.shouldInvalidateInstances
      || invalidatedOperationIdsRef.current.has(snapshot.id)) return;

    invalidatedOperationIdsRef.current.add(snapshot.id);
    try {
      await invalidateInstances();
    } catch (error) {
      invalidatedOperationIdsRef.current.delete(snapshot.id);
      if (mountedRef.current) setLoadError(error);
      throw error;
    }
  }, [invalidateInstances]);

  const loadRecovered = useCallback(async (reuseBootstrap: boolean) => {
    const generation = ++loadGenerationRef.current;
    const request = reuseBootstrap
      ? (bootstrapPromiseRef.current ?? operationsIPC.listRecovered())
      : operationsIPC.listRecovered();
    if (reuseBootstrap) bootstrapPromiseRef.current = request;

    try {
      const values = await request;
      const accepted = normalizeRecoverySnapshots(values)
        .filter(({ id }) => !dismissedIdsRef.current.has(id));
      if (!mountedRef.current || generation !== loadGenerationRef.current) return [];
      setRecords(accepted);
      setLoadError(null);
      return accepted;
    } catch (error) {
      if (mountedRef.current && generation === loadGenerationRef.current) setLoadError(error);
      throw error;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!recoveryInboxEnabled) return;
    void loadRecovered(true)
      .then((accepted) => Promise.all(accepted.map(invalidateCommittedRecovery)))
      .catch(() => undefined);
  }, [invalidateCommittedRecovery, loadRecovered, recoveryInboxEnabled]);

  const inspect = useCallback(async (operationId: string) => {
    const generation = ++inspectGenerationRef.current;
    setInspectingId(operationId);
    setLoadError(null);
    try {
      const snapshot = await operationsIPC.get(operationId);
      if (generation !== inspectGenerationRef.current || !mountedRef.current) return;
      if (!isRecoverySnapshot(snapshot) || snapshot.id !== operationId) {
        throw new Error('The selected recovery record is no longer available');
      }
      setRecords((current) => replaceRecoveryRecord(current, snapshot));
      setSelected(snapshot);
      await invalidateCommittedRecovery(snapshot);
    } catch (error) {
      if (generation === inspectGenerationRef.current && mountedRef.current) setLoadError(error);
    } finally {
      if (generation === inspectGenerationRef.current && mountedRef.current) setInspectingId(null);
    }
  }, [invalidateCommittedRecovery]);

  const dismiss = useCallback((operationId: string) => {
    dismissedIdsRef.current = rememberDismissedRecoveryId(dismissedIdsRef.current, operationId);
    inspectGenerationRef.current += 1;
    setInspectingId(null);
    setRecords((current) => current.filter(({ id }) => id !== operationId));
    setSelected((current) => current?.id === operationId ? null : current);
  }, []);

  const navigate = useCallback((kind: OperationKind) => {
    if (getOperationRecoveryDestination(kind) === 'modpacks') setMode('modpacks');
  }, [setMode]);

  const recoveryController = useMemo(() => ({
    refreshInbox: async () => {
      await loadRecovered(false);
    },
  }), [loadRecovered]);

  return (
    <OperationRecoveryContext.Provider value={recoveryController}>
      {children}
      {recoveryInboxEnabled ? (
        <OperationRecoveryInbox
          records={records}
          selected={selected}
          inspectingId={inspectingId}
          loadError={loadError}
          onInspect={(operationId) => { void inspect(operationId); }}
          onDismiss={dismiss}
          onNavigate={navigate}
        />
      ) : null}
    </OperationRecoveryContext.Provider>
  );
}
