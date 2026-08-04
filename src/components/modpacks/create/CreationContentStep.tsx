import { useCallback, useEffect, useRef, useState } from 'react';
import { useConfirm } from '../../../contexts/ConfirmContext';
import { useSettings } from '../../../contexts/SettingsContext';
import { useToast } from '../../../contexts/ToastContext';
import { instanceModsIPC } from '../../../services/ipc/instanceModsIPC';
import { toDisplayErrorMessage } from '../../../utils/displayError';
import { DegradedStateView } from '../../layout/DegradedStateView';
import { Button } from '../../ui/Button';
import { AddModModal } from '../AddModModal';
import { ModpackDetailsModsTab, type ModpackModEntry } from '../details';

interface CreationContentStepProps {
  modpackId: string | null;
}

export function CreationContentStep({
  modpackId,
}: CreationContentStepProps) {
  const { t, getAccentStyles } = useSettings();
  const toast = useToast();
  const confirm = useConfirm();
  const tRef = useRef(t);
  const toastRef = useRef(toast);
  tRef.current = t;
  toastRef.current = toast;
  const [mods, setMods] = useState<ModpackModEntry[]>([]);
  const [loadingMods, setLoadingMods] = useState(false);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [modSearchQuery, setModSearchQuery] = useState('');
  const [modFilterStatus, setModFilterStatus] = useState<'all' | 'enabled' | 'disabled'>('all');
  const [showAddModModal, setShowAddModModal] = useState(false);
  const loadGenerationRef = useRef(0);

  const loadMods = useCallback(async () => {
    if (!modpackId) return;
    const generation = ++loadGenerationRef.current;
    setLoadingMods(true);
    setLoadError(null);
    try {
      const list = await instanceModsIPC.list(modpackId);
      if (generation !== loadGenerationRef.current) return;
      setMods(list.map((mod) => ({
        ...mod,
        enabled: !mod.file.name.endsWith('.disabled'),
      })));
    } catch (error) {
      if (generation !== loadGenerationRef.current) return;
      console.error('Error loading mods for the newly created modpack:', error);
      setMods([]);
      setLoadError(error);
      toastRef.current.error(
        tRef.current('wizard.content_load_error_title') || 'Unable to load installed mods',
      );
    } finally {
      if (generation === loadGenerationRef.current) setLoadingMods(false);
    }
  }, [modpackId]);

  useEffect(() => {
    void loadMods();
    return () => {
      loadGenerationRef.current += 1;
    };
  }, [loadMods]);

  const handleRemove = useCallback(async (mod: ModpackModEntry) => {
    if (!modpackId) return;
    const confirmed = await confirm.confirm({
      title: t('modpacks.remove') || 'Remove mod',
      message: t('modpacks.remove_mod_confirm')?.replace('{{name}}', mod.name) || `Remove mod "${mod.name}"?`,
      variant: 'danger',
      confirmText: t('modpacks.remove') || 'Remove',
      cancelText: t('general.cancel') || 'Cancel',
    });
    if (!confirmed) return;

    try {
      await instanceModsIPC.remove(modpackId, mod.file.name);
      await loadMods();
    } catch (error) {
      console.error('Error removing mod from the newly created modpack:', error);
      toast.error(t('modpacks.remove_mod_error') || 'Unable to remove mod');
    }
  }, [confirm, loadMods, modpackId, t, toast]);

  if (!modpackId) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12" role="status">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {t('modpacks.creating') || 'Creating...'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="mb-4 space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
        <p>{t('wizard.step3_desc') || 'Add mods to your modpack (optional).'}</p>
        <p>{t('wizard.step3_desc2') || 'You can skip this step and add mods later.'}</p>
      </div>
      {loadError ? (
        <DegradedStateView
          variant="error"
          layout="workspace"
          testId="modpack-creation-content-load-error"
          title={t('wizard.content_load_error_title') || 'Unable to load installed mods'}
          description={toDisplayErrorMessage(
            loadError,
            t('wizard.content_load_error_desc')
              || 'The modpack was created, but its installed-mod list is temporarily unavailable.',
          )}
          footer={(
            <>
              <Button variant="secondary" onClick={() => setShowAddModModal(true)}>
                {t('modpacks.add_mod_title') || 'Add mods'}
              </Button>
              <Button onClick={() => { void loadMods(); }}>
                {t('operations.retry') || 'Retry'}
              </Button>
            </>
          )}
        />
      ) : (
        <ModpackDetailsModsTab
          mods={mods}
          loadingMods={loadingMods}
          modSearchQuery={modSearchQuery}
          onModSearchQueryChange={setModSearchQuery}
          modFilterStatus={modFilterStatus}
          onModFilterStatusChange={setModFilterStatus}
          onAddMod={() => setShowAddModModal(true)}
          onRemoveMod={handleRemove}
          onModToggle={() => {
            toast.info(
              t('modpacks.mod_toggle_coming_soon')
                || 'Mod enable/disable will be available in a future update',
            );
          }}
          t={t}
          getAccentStyles={getAccentStyles}
        />
      )}
      <AddModModal
        modpackId={modpackId}
        isOpen={showAddModModal}
        onClose={() => setShowAddModModal(false)}
        onAdded={loadMods}
      />
    </div>
  );
}
