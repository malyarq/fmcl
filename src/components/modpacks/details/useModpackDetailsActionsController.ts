import { useCallback } from 'react';
import { useConfirm } from '../../../contexts/ConfirmContext';
import { useInstanceCrudActions } from '../../../contexts/instances/hooks/useInstanceCrudActions';
import { useSettings } from '../../../contexts/SettingsContext';
import { useToast } from '../../../contexts/ToastContext';
import { useInstanceInvalidation } from '../../../features/instances/hooks/useInstanceInvalidation';
import { useInstanceList } from '../../../features/instances/hooks/useInstanceSelectors';

interface UseModpackDetailsActionsControllerParams {
  modpackId: string;
  onBack: () => void;
  onLaunch?: () => void | Promise<void>;
}

export function useModpackDetailsActionsController({
  modpackId,
  onBack,
  onLaunch,
}: UseModpackDetailsActionsControllerParams) {
  const { t } = useSettings();
  const listQuery = useInstanceList();
  const { invalidateInstances } = useInstanceInvalidation();
  const {
    cancelDelete,
    cancelDuplicate,
    deleteOperation,
    deleteOperationError,
    duplicate,
    duplicateOperation,
    duplicateOperationError,
    remove,
    rename,
    retryDelete,
    retryDuplicate,
    select,
  } = useInstanceCrudActions({ invalidateInstances });
  const modpacks = listQuery.status === 'ready' ? listQuery.data : [];
  const refresh = invalidateInstances;
  const toast = useToast();
  const confirm = useConfirm();
  const modpack = modpacks.find((candidate) => candidate.id === modpackId);

  const deleteModpack = useCallback(async () => {
    if (!modpack) return;
    const confirmed = await confirm.confirm({
      title: t('modpacks.delete') || 'Delete modpack',
      message: (t('modpacks.delete_confirm') || 'Delete "{{name}}"?').replace('{{name}}', modpack.name),
      variant: 'danger',
      confirmText: t('modpacks.delete') || 'Delete',
      cancelText: t('general.cancel') || 'Cancel',
    });
    if (!confirmed) return;
    const terminal = await remove(modpackId);
    if (terminal?.classification.mayCloseSurface) onBack();
  }, [confirm, modpack, modpackId, onBack, remove, t]);

  const renameModpack = useCallback(async () => {
    if (!modpack) return;
    const nextName = await confirm.prompt({
      title: t('modpacks.rename') || 'Rename',
      message: t('modpacks.rename_prompt') || 'Enter a new name:',
      confirmText: t('modpacks.rename') || 'Rename',
      cancelText: t('general.cancel') || 'Cancel',
      input: {
        initialValue: modpack.name,
        placeholder: modpack.name,
        requireNonEmpty: true,
      },
    });
    const normalizedName = nextName?.trim();
    if (!normalizedName || normalizedName === modpack.name) return;
    try {
      await rename(modpackId, normalizedName);
    } catch (error) {
      console.error('Error renaming modpack:', error);
      toast.error(t('modpacks.rename_error') || 'Error renaming modpack');
    }
  }, [confirm, modpack, modpackId, rename, t, toast]);

  const duplicateModpack = useCallback(async () => {
    if (!modpack) return;
    const suggestedName = `${modpack.name} - Copy`;
    const nextName = await confirm.prompt({
      title: t('modpacks.duplicate') || 'Duplicate',
      message: t('modpacks.duplicate_prompt') || 'Enter a copy name:',
      confirmText: t('modpacks.duplicate') || 'Duplicate',
      cancelText: t('general.cancel') || 'Cancel',
      input: {
        initialValue: suggestedName,
        placeholder: suggestedName,
        requireNonEmpty: true,
      },
    });
    const normalizedName = nextName?.trim();
    if (!normalizedName) return;
    try {
      await duplicate(modpackId, normalizedName);
    } catch (error) {
      console.error('Error duplicating modpack:', error);
      toast.error(t('modpacks.duplicate_error') || 'Error duplicating modpack');
    }
  }, [confirm, duplicate, modpack, modpackId, t, toast]);

  const launch = useCallback(async () => {
    await select(modpackId);
    onBack();
    if (onLaunch) setTimeout(() => { void onLaunch(); }, 0);
  }, [modpackId, onBack, onLaunch, select]);

  return {
    modpack,
    refresh,
    actions: {
      canDelete: modpacks.length > 1,
      delete: deleteModpack,
      duplicate: duplicateModpack,
      launch,
      rename: renameModpack,
    },
    operationNotices: {
      cancelDelete,
      cancelDuplicate,
      deleteOperation,
      deleteOperationError,
      duplicateOperation,
      duplicateOperationError,
      retryDelete,
      retryDuplicate,
    },
  };
}
