import React, { useState, useEffect, useCallback } from 'react';
import { useSettings } from '../../contexts/SettingsContext';
import { useModpack } from '../../contexts/ModpackContext';
import { useToast } from '../../contexts/ToastContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import { Button } from '../ui/Button';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { ModpackUpdateModal } from './ModpackUpdateModal';
import { modpacksIPC } from '../../services/ipc/modpacksIPC';
import type { ModpackMetadata } from '@shared/types/modpack';
import type { ModpackVersionDescriptor } from '@shared/contracts';
import { useModpackDetailsConfig } from '../../features/modpacks/hooks/useModpackDetailsConfig';
import {
  ModpackDetailsHeader,
  ModpackDetailsInfoTab,
  ModpackDetailsModsTab,
  ModpackDetailsSettingsTab,
  ModpackDetailsActions,
  type ModpackDetailsTab,
  type ModpackModEntry,
} from './details';
import { useVersions } from '../../features/launcher/hooks/useVersions';
import { useModSupportedVersions } from '../../features/launcher/hooks/useModSupportedVersions';

interface ModpackDetailsProps {
  modpackId: string;
  onBack: () => void;
  onNavigate: (view: { type: 'addMod'; modpackId: string } | { type: 'export'; modpackId: string }) => void;
  onLaunch?: () => void | Promise<void>;
  onMetadataUpdated?: (metadata: ModpackMetadata) => void;
}

export const ModpackDetails: React.FC<ModpackDetailsProps> = ({ modpackId, onBack, onNavigate, onLaunch, onMetadataUpdated }) => {
  const { t, getAccentStyles, getAccentHex, minecraftPath } = useSettings();
  const { modpacks, select, remove, refresh } = useModpack();
  const toast = useToast();
  const confirm = useConfirm();

  const [metadata, setMetadata] = useState<ModpackMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ModpackDetailsTab>('info');
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [hasUpdate, setHasUpdate] = useState(false);
  const [mods, setMods] = useState<ModpackModEntry[]>([]);
  const [loadingMods, setLoadingMods] = useState(false);
  const [modSearchQuery, setModSearchQuery] = useState('');
  const [modFilterStatus, setModFilterStatus] = useState<'all' | 'enabled' | 'disabled'>('all');
  const [descriptionDraft, setDescriptionDraft] = useState('');

  const { effectiveConfig, loadModpackConfig, setters } = useModpackDetailsConfig({ modpackId, minecraftPath });
  const { versions } = useVersions();
  const { forgeVersions, fabricVersions, neoForgeVersions, optiFineVersions } = useModSupportedVersions();

  const modpack = modpacks.find((m) => m.id === modpackId);

  const loaderType = effectiveConfig?.runtime?.modLoader?.type ?? metadata?.modLoader?.type;
  const hasModloader = !!loaderType && loaderType !== 'vanilla';

  useEffect(() => {
    loadModpackConfig();
  }, [loadModpackConfig]);

  useEffect(() => {
    if (!hasModloader && activeTab === 'mods') setActiveTab('info');
  }, [hasModloader, activeTab]);

  useEffect(() => {
    if (activeTab === 'settings') loadModpackConfig();
  }, [activeTab, loadModpackConfig]);

  const loadDetails = useCallback(async () => {
    setLoading(true);
    try {
      const meta = await modpacksIPC.getMetadata(modpackId, minecraftPath);
      setMetadata(meta);
      setDescriptionDraft(meta.description || '');

      if (meta.source && meta.source !== 'local' && meta.sourceId) {
        try {
          let versionsList: ModpackVersionDescriptor[];
          if (meta.source === 'curseforge') {
            versionsList = await modpacksIPC.getCurseForgeVersions(Number(meta.sourceId));
          } else if (meta.source === 'modrinth') {
            versionsList = await modpacksIPC.getModrinthVersions(meta.sourceId);
          } else {
            return;
          }
          if (versionsList.length > 0) {
            const latest = versionsList[0];
            const currentVersionId = meta.sourceVersionId || meta.version;
            if (latest.versionId !== currentVersionId) {
              setHasUpdate(true);
            }
          }
        } catch (error) {
          console.error('Error checking for updates:', error);
        }
      }
    } catch (error) {
      console.error('Error loading modpack details:', error);
      setMetadata(null);
    } finally {
      setLoading(false);
    }
  }, [modpackId, minecraftPath]);

  useEffect(() => {
    if (!modpackId) return;
    loadDetails();
  }, [modpackId, loadDetails]);

  const loadMods = useCallback(async () => {
    if (activeTab !== 'mods') return;
    setLoadingMods(true);
    try {
      const modsList = await modpacksIPC.getMods(modpackId, minecraftPath);
      const modsWithStatus: ModpackModEntry[] = modsList.map((mod) => ({
        ...mod,
        enabled: !mod.file.name.endsWith('.disabled'),
      }));
      setMods(modsWithStatus);
    } catch (error) {
      console.error('Error loading mods:', error);
      setMods([]);
    } finally {
      setLoadingMods(false);
    }
  }, [activeTab, modpackId, minecraftPath]);

  useEffect(() => {
    if (activeTab === 'mods') {
      loadMods();
    }
  }, [activeTab, loadMods]);

  const handleSaveDescription = async () => {
    if (!modpackId) return;
    try {
      const updated = await modpacksIPC.updateMetadata(
        modpackId,
        { description: descriptionDraft.trim() || undefined },
        minecraftPath
      );
      setMetadata(updated);
      onMetadataUpdated?.(updated);
      await refresh();
    } catch (error) {
      console.error('Error updating modpack description:', error);
      toast.error(t('modpacks.update_error') || 'Ошибка при обновлении описания модпака');
    }
  };

  const handleDelete = async () => {
    if (!modpack) return;
    const confirmText =
      t('modpacks.delete_confirm')?.replace('{{name}}', modpack.name) ||
      `Удалить модпак "${modpack.name}"?`;
    const confirmed = await confirm.confirm({
      title: t('modpacks.delete') || 'Удалить модпак',
      message: confirmText,
      variant: 'danger',
      confirmText: t('modpacks.delete') || 'Удалить',
      cancelText: t('general.cancel') || 'Отмена',
    });
    if (confirmed) {
      await remove(modpackId);
      await refresh();
      onBack();
    }
  };

  const handleDuplicate = async () => {
    if (!modpack) return;
    try {
      const result = await modpacksIPC.duplicate(modpackId);
      if (result?.id) {
        await refresh();
      }
    } catch (error) {
      console.error('Error duplicating modpack:', error);
      toast.error(t('modpacks.duplicate_error') || 'Ошибка при дублировании модпака');
    }
  };

  const handleRemoveMod = async (mod: ModpackModEntry) => {
    const confirmed = await confirm.confirm({
      title: t('modpacks.remove') || 'Удалить мод',
      message:
        t('modpacks.remove_mod_confirm')?.replace('{{name}}', mod.name) || `Удалить мод "${mod.name}"?`,
      variant: 'danger',
      confirmText: t('modpacks.remove') || 'Удалить',
      cancelText: t('general.cancel') || 'Отмена',
    });
    if (confirmed) {
      try {
        await modpacksIPC.removeMod(modpackId, mod.file.name, minecraftPath);
        await loadMods();
      } catch (error) {
        console.error('Error removing mod:', error);
        toast.error(t('modpacks.remove_mod_error') || 'Ошибка при удалении мода');
      }
    }
  };

  const handleModToggle = async (mod: ModpackModEntry) => {
    const enabled = !(mod.enabled ?? true);
    setMods((prev) =>
      prev.map((m) => (m.id === mod.id ? { ...m, enabled } : m))
    );
    try {
      await modpacksIPC.setModEnabled(modpackId, mod.file.name, enabled, minecraftPath);
    } catch (error) {
      setMods((prev) =>
        prev.map((m) => (m.id === mod.id ? { ...m, enabled: !enabled } : m))
      );
      console.error('Error toggling mod:', error);
      toast.error(t('modpacks.mod_toggle_error') || 'Ошибка при переключении мода');
    }
  };

  if (!modpack) return null;

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <div className="flex items-center gap-4 p-6 border-b border-zinc-200 dark:border-zinc-700 bg-white/60 dark:bg-zinc-900/40 flex-shrink-0">
        <Button variant="secondary" size="sm" onClick={onBack} className="flex items-center gap-2">
          <span>←</span>
          {t('general.back') || 'Назад'}
        </Button>
        <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
          {t('modpacks.settings_title') || t('modpacks.tab_settings') || 'Modpack settings'}
        </h2>
      </div>

      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <LoadingSpinner size="lg" />
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{t('modpacks.loading')}</p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <ModpackDetailsHeader
              modpackName={modpack.name}
              metadata={metadata}
              effectiveConfig={effectiveConfig}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              t={t}
              getAccentStyles={getAccentStyles}
              getAccentHex={getAccentHex}
            />

            <div className="flex-1 min-h-0 min-w-0 flex flex-col overflow-hidden">
              <div className="flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden custom-scrollbar">
                <div className="p-6 pb-4 min-h-0 min-w-0">
                  {activeTab === 'info' && (
                    <ModpackDetailsInfoTab
                      descriptionDraft={descriptionDraft}
                      onDescriptionChange={setDescriptionDraft}
                      onSaveDescription={handleSaveDescription}
                      metadata={metadata}
                      t={t}
                    />
                  )}

                  {activeTab === 'mods' && hasModloader && (
                    <ModpackDetailsModsTab
                      mods={mods}
                      loadingMods={loadingMods}
                      modSearchQuery={modSearchQuery}
                      onModSearchQueryChange={setModSearchQuery}
                      modFilterStatus={modFilterStatus}
                      onModFilterStatusChange={setModFilterStatus}
                      onAddMod={() => onNavigate({ type: 'addMod', modpackId })}
                      onRemoveMod={handleRemoveMod}
                      onModToggle={handleModToggle}
                      t={t}
                      getAccentStyles={getAccentStyles}
                    />
                  )}

                  {activeTab === 'settings' && (
                    <ModpackDetailsSettingsTab
                      effectiveConfig={effectiveConfig}
                      setters={setters}
                      versions={versions}
                      forgeVersions={forgeVersions}
                      fabricVersions={fabricVersions}
                      neoForgeVersions={neoForgeVersions}
                      optiFineVersions={optiFineVersions}
                      onRefresh={async () => {
                        await refresh();
                        await loadModpackConfig();
                      }}
                      minecraftPath={minecraftPath}
                      t={t}
                      getAccentStyles={getAccentStyles}
                    />
                  )}
                </div>
              </div>

              <ModpackDetailsActions
                onLaunch={async () => {
                  await select(modpackId);
                  onBack();
                  // Defer launch to next tick so ModpackContext has time to update config
                  if (onLaunch) setTimeout(() => onLaunch(), 0);
                }}
                hasUpdate={hasUpdate && !!metadata?.source && !!metadata?.sourceId && metadata.source !== 'local'}
                onShowUpdate={() => setShowUpdateModal(true)}
                onDuplicate={handleDuplicate}
                onExport={() => onNavigate({ type: 'export', modpackId })}
                canDelete={modpacks.length > 1}
                onDelete={handleDelete}
                t={t}
                getAccentStyles={getAccentStyles}
              />
            </div>
          </div>
        )}

        {showUpdateModal && metadata?.source && metadata?.sourceId && metadata.source !== 'local' && (
          <ModpackUpdateModal
            modpackId={modpackId}
            sourceId={metadata.sourceId}
            source={metadata.source as 'curseforge' | 'modrinth'}
            currentVersion={metadata.sourceVersionId || metadata.version}
            isOpen={showUpdateModal}
            onClose={() => setShowUpdateModal(false)}
            onUpdated={async () => {
              await refresh();
              await loadDetails();
              setShowUpdateModal(false);
            }}
          />
        )}
      </div>
    </div>
  );
};
