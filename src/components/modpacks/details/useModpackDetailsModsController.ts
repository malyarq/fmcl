import { useCallback, useEffect, useRef, useState } from 'react';
import { useConfirm } from '../../../contexts/ConfirmContext';
import { useSettings } from '../../../contexts/SettingsContext';
import { useToast } from '../../../contexts/ToastContext';
import { instanceModsIPC } from '../../../services/ipc/instanceModsIPC';
import type { ModpackDetailsTab } from './ModpackDetailsHeader';
import type { ModpackModEntry } from './ModpackDetailsModsTab';

interface UseModpackDetailsModsControllerParams {
  activeTab: ModpackDetailsTab;
  hydrateFromIpc: boolean;
  initialMods?: ModpackModEntry[];
  modpackId: string;
}

export function useModpackDetailsModsController({
  activeTab,
  hydrateFromIpc,
  initialMods,
  modpackId,
}: UseModpackDetailsModsControllerParams) {
  const { t } = useSettings();
  const toast = useToast();
  const confirm = useConfirm();
  const [mods, setMods] = useState<ModpackModEntry[]>(initialMods ?? []);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'enabled' | 'disabled'>('all');
  const generationRef = useRef(0);

  const load = useCallback(async () => {
    if (!hydrateFromIpc) {
      setLoading(false);
      return;
    }
    const generation = ++generationRef.current;
    setLoading(true);
    try {
      const entries = await instanceModsIPC.list(modpackId);
      if (generation !== generationRef.current) return;
      setMods(entries.map((mod) => ({
        ...mod,
        enabled: !mod.file.name.endsWith('.disabled'),
      })));
    } catch (error) {
      console.error('Error loading mods:', error);
      if (generation === generationRef.current) setMods([]);
    } finally {
      if (generation === generationRef.current) setLoading(false);
    }
  }, [hydrateFromIpc, modpackId]);

  useEffect(() => {
    if (activeTab === 'mods') void load();
  }, [activeTab, load]);

  useEffect(() => () => {
    generationRef.current += 1;
  }, []);

  const remove = useCallback(async (mod: ModpackModEntry) => {
    const confirmed = await confirm.confirm({
      title: t('modpacks.remove') || 'Remove mod',
      message: (t('modpacks.remove_mod_confirm') || 'Remove "{{name}}"?').replace('{{name}}', mod.name),
      variant: 'danger',
      confirmText: t('modpacks.remove') || 'Remove',
      cancelText: t('general.cancel') || 'Cancel',
    });
    if (!confirmed) return;
    try {
      await instanceModsIPC.remove(modpackId, mod.file.name);
      await load();
    } catch (error) {
      console.error('Error removing mod:', error);
      toast.error(t('modpacks.remove_mod_error') || 'Error removing mod');
    }
  }, [confirm, load, modpackId, t, toast]);

  const toggle = useCallback(async (mod: ModpackModEntry) => {
    const enabled = !(mod.enabled ?? true);
    setMods((current) => current.map((entry) => (
      entry.id === mod.id ? { ...entry, enabled } : entry
    )));
    try {
      await instanceModsIPC.setEnabled(modpackId, mod.file.name, enabled);
    } catch (error) {
      setMods((current) => current.map((entry) => (
        entry.id === mod.id ? { ...entry, enabled: !enabled } : entry
      )));
      console.error('Error toggling mod:', error);
      toast.error(t('modpacks.mod_toggle_error') || 'Error toggling mod');
    }
  }, [modpackId, t, toast]);

  return {
    filterStatus,
    load,
    loading,
    mods,
    remove,
    searchQuery,
    setFilterStatus,
    setSearchQuery,
    toggle,
  };
}
