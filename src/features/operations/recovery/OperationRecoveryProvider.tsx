import type { OperationKind, OperationPhase, OperationSnapshot } from '@shared/contracts';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useUIMode } from '../../../contexts/SettingsContext';
import { operationsIPC } from '../../../services/ipc/operationsIPC';
import { useInstanceInvalidation } from '../../instances/hooks/useInstanceInvalidation';
import { classifyOperationTerminal } from '../operationTerminalPolicy';
import { OperationRecoveryInbox } from './OperationRecoveryInbox';
import { getOperationRecoveryDestination } from './operationRecoveryPolicy';
import { OperationRecoveryContext } from './OperationRecoveryContext';

const OPERATION_KINDS = new Set<OperationKind>([
  'duplicate',
  'import',
  'import-share',
  'install-curseforge',
  'install-modrinth',
  'update',
  'delete',
  'export',
]);
const OPERATION_PHASES = new Set<OperationPhase>([
  'started',
  'staged',
  'validated',
  'publish-intent',
  'backup-created',
  'published',
  'control-plane-committed',
  'completed',
  'failed',
  'cancelled',
  'recovery-required',
]);
const OPERATION_ID_PATTERN = /^[A-Za-z0-9._:-]{1,160}$/;

export function OperationRecoveryProvider({ children }: { children: ReactNode }) {
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
      const accepted = normalizeRecoverySnapshots(values);
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
    void loadRecovered(true)
      .then((accepted) => Promise.all(accepted.map(invalidateCommittedRecovery)))
      .catch(() => undefined);
  }, [invalidateCommittedRecovery, loadRecovered]);

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
      <OperationRecoveryInbox
        records={records}
        selected={selected}
        inspectingId={inspectingId}
        loadError={loadError}
        onInspect={(operationId) => { void inspect(operationId); }}
        onDismiss={dismiss}
        onNavigate={navigate}
      />
    </OperationRecoveryContext.Provider>
  );
}

function normalizeRecoverySnapshots(values: unknown) {
  if (!Array.isArray(values)) throw new Error('The recovery journal returned an invalid result');
  const accepted = values.filter(isRecoverySnapshot);
  const byId = new Map<string, OperationSnapshot>();
  for (const snapshot of accepted) byId.set(snapshot.id, snapshot);
  return [...byId.values()].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

function isRecoverySnapshot(value: unknown): value is OperationSnapshot {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const snapshot = value as Partial<OperationSnapshot>;
  if (typeof snapshot.id !== 'string' || !OPERATION_ID_PATTERN.test(snapshot.id)) return false;
  if (typeof snapshot.kind !== 'string' || !OPERATION_KINDS.has(snapshot.kind as OperationKind)) return false;
  if (snapshot.status !== 'recovered' && snapshot.status !== 'recovery-required') return false;
  if (snapshot.result?.status !== snapshot.status) return false;
  if (typeof snapshot.phase !== 'string' || !OPERATION_PHASES.has(snapshot.phase as OperationPhase)
    || typeof snapshot.createdAt !== 'string'
    || typeof snapshot.updatedAt !== 'string') return false;
  if ((snapshot.status === 'recovered' && snapshot.phase !== 'completed')
    || (snapshot.status === 'recovery-required' && snapshot.phase !== 'recovery-required')) return false;
  if (!snapshot.progress
    || typeof snapshot.progress.completed !== 'number'
    || !Number.isFinite(snapshot.progress.completed)
    || snapshot.progress.completed < 0
    || typeof snapshot.progress.total !== 'number'
    || !Number.isFinite(snapshot.progress.total)
    || snapshot.progress.total < 0) return false;
  if (!Number.isFinite(Date.parse(snapshot.createdAt)) || !Number.isFinite(Date.parse(snapshot.updatedAt))) return false;
  return true;
}

function replaceRecoveryRecord(
  records: readonly OperationSnapshot[],
  next: OperationSnapshot,
) {
  const updated = records.map((current) => current.id === next.id ? next : current);
  return updated.some(({ id }) => id === next.id) ? updated : [next, ...updated];
}
