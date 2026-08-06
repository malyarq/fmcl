import { useCallback, useEffect, useRef, useState } from 'react';
import type { InstanceSnapshotDto } from '@shared/contracts';
import { PackagePlus } from 'lucide-react';
import { useSettings } from '../../contexts/SettingsContext';
import { useToast } from '../../contexts/ToastContext';
import { ModContentAcquisition } from '../../features/content/components/ModContentAcquisition';
import type { AcquisitionOutcome } from '../../features/content/contentAcquisitionTypes';
import { instancesIPC } from '../../services/ipc/instancesIPC';
import { toDisplayErrorMessage } from '../../utils/displayError';
import { DegradedStateView } from '../layout/DegradedStateView';
import { Button } from '../ui/Button';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { Modal } from '../ui/Modal';

interface AddModModalProps {
  modpackId: string;
  isOpen: boolean;
  onClose: () => void;
  onAdded?: () => void | Promise<void>;
  defaultMCVersion?: string;
  defaultLoader?: string;
}

type RuntimeState =
  | { status: 'loading' }
  | { status: 'error'; error: unknown }
  | { status: 'ready'; snapshot: InstanceSnapshotDto };

export function AddModModal({
  modpackId,
  isOpen,
  onClose,
  onAdded,
  defaultMCVersion,
  defaultLoader,
}: AddModModalProps) {
  const { t } = useSettings();
  const toast = useToast();
  const [runtimeState, setRuntimeState] = useState<RuntimeState>({ status: 'loading' });
  const [busy, setBusy] = useState(false);
  const loadGenerationRef = useRef(0);
  const onAddedRef = useRef(onAdded);
  onAddedRef.current = onAdded;

  const loadRuntime = useCallback(async () => {
    const generation = ++loadGenerationRef.current;
    setRuntimeState({ status: 'loading' });
    try {
      const result = await instancesIPC.snapshot({ id: modpackId });
      if (generation !== loadGenerationRef.current) return;
      if (!result.ok) throw new Error(result.error.message);
      setRuntimeState({ status: 'ready', snapshot: result.value });
    } catch (error) {
      if (generation === loadGenerationRef.current) setRuntimeState({ status: 'error', error });
    }
  }, [modpackId]);

  useEffect(() => {
    if (!isOpen) {
      loadGenerationRef.current += 1;
      setBusy(false);
      return;
    }
    void loadRuntime();
  }, [isOpen, loadRuntime]);

  const handleCommitted = useCallback(async (_outcome: AcquisitionOutcome) => {
    await onAddedRef.current?.();
  }, []);

  const handleSuccess = useCallback(() => {
    toast.success(t('modpacks.add_mod_success') || 'Mods added');
    onClose();
  }, [onClose, t, toast]);

  if (!isOpen) return null;

  const runtime = runtimeState.status === 'ready' ? {
    instanceId: modpackId,
    minecraftVersion: defaultMCVersion || runtimeState.snapshot.config.runtime.minecraftVersion,
    loader: defaultLoader || runtimeState.snapshot.config.runtime.modLoader?.type,
  } : null;

  return (
    <Modal
      isOpen
      onClose={onClose}
      closeDisabled={busy}
      closeLabel={t('general.close_dialog')}
      title={(
        <span className="flex min-w-0 items-center gap-3">
          <PackagePlus className="h-4 w-4 shrink-0 text-secondary" />
          <span className="truncate">{t('modpacks.add_mod_title') || 'Add mods'}</span>
        </span>
      )}
      className="max-w-3xl"
      bodyClassName="flex min-h-0 flex-1 flex-col"
      bodyProps={{ style: { overflow: 'hidden' } }}
    >
      {runtimeState.status === 'loading' ? (
        <div className="flex min-h-[20rem] items-center justify-center gap-3" role="status">
          <LoadingSpinner size="lg" />
          <span className="text-sm text-secondary">{t('modpacks.loading')}</span>
        </div>
      ) : null}

      {runtimeState.status === 'error' ? (
        <DegradedStateView
          variant="error"
          layout="workspace"
          title={t('modpacks.add_mod_runtime_error') || 'Unable to load this modpack'}
          description={toDisplayErrorMessage(
            runtimeState.error,
            t('modpacks.add_mod_runtime_error_desc') || 'FMCL could not read the current Minecraft and modloader versions.',
          )}
          footer={(
            <div className="flex gap-2">
              <Button variant="secondary" onClick={onClose}>{t('general.cancel')}</Button>
              <Button onClick={() => { void loadRuntime(); }}>{t('operations.retry') || 'Retry'}</Button>
            </div>
          )}
        />
      ) : null}

      {runtime ? (
        <ModContentAcquisition
          runtime={runtime}
          onCancel={onClose}
          onCommitted={handleCommitted}
          onSuccess={handleSuccess}
          onBusyChange={setBusy}
          className="flex h-full min-h-0 flex-col gap-4"
          resultsClassName="min-h-[14rem] flex-1 overflow-y-auto pr-1"
          actionsClassName="surface-inline shrink-0 space-y-3 p-4"
          testIds={{
            resultsViewport: 'add-mod-modal-results-scroll',
            results: 'add-mod-modal-results',
            actions: 'add-mod-modal-actions',
            outcome: 'add-mod-modal-notice',
          }}
        />
      ) : null}
    </Modal>
  );
}
