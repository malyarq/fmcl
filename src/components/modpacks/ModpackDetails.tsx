import React, { useState, useEffect, useCallback } from 'react';
import { useSettings } from '../../contexts/SettingsContext';
import { useModpack, type ModpackConfig } from '../../contexts/ModpackContext';
import { useToast } from '../../contexts/ToastContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import { Button } from '../ui/Button';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { Modal } from '../ui/Modal';
import { ExportModpackModal } from './ExportModpackModal';
import { ModpackUpdateModal } from './ModpackUpdateModal';
import { AddModModal } from './AddModModal';
import { modpacksIPC } from '../../services/ipc/modpacksIPC';
import type { ModpackMetadata } from '@shared/types/modpack';
import type { ModpackVersionDescriptor } from '@shared/contracts';
import { cn } from '../../utils/cn';
import { GameTab } from '../settings/tabs/GameTab';
import { fetchModpackConfig } from '../../contexts/instances/services/instancesService';

interface ModpackDetailsProps {
  modpackId: string;
  isOpen: boolean;
  onClose: () => void;
}

export const ModpackDetails: React.FC<ModpackDetailsProps> = ({ modpackId, isOpen, onClose }) => {
  const { t, getAccentStyles, getAccentHex, minecraftPath } = useSettings();
  const { modpacks, select, remove, refresh, selectedId, setMemoryGb, setJavaPath, setVmOptions, setGameExtraArgs, setGameResolution, setAutoConnectServer, saveConfig } = useModpack();
  const toast = useToast();
  const confirm = useConfirm();
  const [metadata, setMetadata] = useState<ModpackMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'info' | 'mods' | 'settings'>('info');
  const [showExportModal, setShowExportModal] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [showAddModModal, setShowAddModModal] = useState(false);
  const [hasUpdate, setHasUpdate] = useState(false);
  const [mods, setMods] = useState<Array<{
    id: string;
    name: string;
    version: string;
    loaders: string[];
    file: { path: string; name: string; size: number; mtimeMs: number };
  }>>([]);
  const [loadingMods, setLoadingMods] = useState(false);
  const [modpackConfig, setModpackConfig] = useState<ModpackConfig | null>(null);

  const modpack = modpacks.find((m) => m.id === modpackId);
  const isSelectedModpack = selectedId === modpackId;

  // Load modpack config for settings tab
  const loadModpackConfig = useCallback(async () => {
    try {
      const config = await fetchModpackConfig(modpackId, minecraftPath);
      setModpackConfig(config);
    } catch (error) {
      console.error('Error loading modpack config:', error);
    }
  }, [modpackId, minecraftPath]);

  // Wrapper functions for settings that work with the viewed modpack
  const handleSetMemoryGb = useCallback(async (gb: number) => {
    if (isSelectedModpack) {
      setMemoryGb(gb);
    } else if (modpackConfig) {
      const updated = { ...modpackConfig, memoryGb: gb };
      setModpackConfig(updated);
      await saveConfig(updated);
    }
  }, [isSelectedModpack, modpackConfig, setMemoryGb, saveConfig]);

  const handleSetJavaPath = useCallback(async (path: string) => {
    if (isSelectedModpack) {
      setJavaPath(path);
    } else if (modpackConfig) {
      const updated = { ...modpackConfig, javaPath: path };
      setModpackConfig(updated);
      await saveConfig(updated);
    }
  }, [isSelectedModpack, modpackConfig, setJavaPath, saveConfig]);

  const handleSetVmOptions = useCallback(async (options: string[]) => {
    if (isSelectedModpack) {
      setVmOptions(options);
    } else if (modpackConfig) {
      const updated = { ...modpackConfig, vmOptions: options };
      setModpackConfig(updated);
      await saveConfig(updated);
    }
  }, [isSelectedModpack, modpackConfig, setVmOptions, saveConfig]);

  const handleSetGameExtraArgs = useCallback(async (args: string[]) => {
    if (isSelectedModpack) {
      setGameExtraArgs(args);
    } else if (modpackConfig) {
      const updated = { ...modpackConfig, game: { ...modpackConfig.game, extraArgs: args } };
      setModpackConfig(updated);
      await saveConfig(updated);
    }
  }, [isSelectedModpack, modpackConfig, setGameExtraArgs, saveConfig]);

  const handleSetGameResolution = useCallback(async (resolution?: { width?: number; height?: number; fullscreen?: boolean }) => {
    if (isSelectedModpack) {
      setGameResolution(resolution);
    } else if (modpackConfig) {
      const updated = { ...modpackConfig, game: { ...modpackConfig.game, resolution } };
      setModpackConfig(updated);
      await saveConfig(updated);
    }
  }, [isSelectedModpack, modpackConfig, setGameResolution, saveConfig]);

  const handleSetAutoConnectServer = useCallback(async (server?: { host: string; port: number }) => {
    if (isSelectedModpack) {
      setAutoConnectServer(server);
    } else if (modpackConfig) {
      const updated = { ...modpackConfig, server };
      setModpackConfig(updated);
      await saveConfig(updated);
    }
  }, [isSelectedModpack, modpackConfig, setAutoConnectServer, saveConfig]);

  useEffect(() => {
    if (activeTab === 'settings' && isOpen) {
      loadModpackConfig();
    }
  }, [activeTab, isOpen, loadModpackConfig]);

  const loadDetails = useCallback(async () => {
    setLoading(true);
    try {
      const meta = await modpacksIPC.getMetadata(modpackId, minecraftPath);
      setMetadata(meta);
      
      // Check for updates if modpack is from CurseForge or Modrinth
      if (meta.source && meta.source !== 'local' && meta.sourceId) {
        try {
          let versions: ModpackVersionDescriptor[];
          if (meta.source === 'curseforge') {
            versions = await modpacksIPC.getCurseForgeVersions(Number(meta.sourceId));
          } else if (meta.source === 'modrinth') {
            versions = await modpacksIPC.getModrinthVersions(meta.sourceId);
          } else {
            return;
          }
          
          // Check if there's a newer version
          if (versions.length > 0) {
            const latest = versions[0];
            const currentVersionId = meta.sourceVersionId || meta.version;
            
            // Simple check: if latest versionId is different from current
            if (latest.versionId !== currentVersionId) {
              setHasUpdate(true);
            }
          }
        } catch (error) {
          console.error('Error checking for updates:', error);
          // Don't show error to user, just silently fail
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
    if (!isOpen || !modpackId) return;
    loadDetails();
  }, [isOpen, modpackId, loadDetails]);

  const handleLaunch = () => {
    select(modpackId);
    onClose();
  };

  const handleDelete = async () => {
    if (!modpack) return;
    const confirmText = t('modpacks.delete_confirm')?.replace('{{name}}', modpack.name) || `Удалить модпак "${modpack.name}"?`;
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
      onClose();
    }
  };

  const handleExport = () => {
    setShowExportModal(true);
  };

  const handleDuplicate = async () => {
    if (!modpack) return;
    try {
      const result = await modpacksIPC.duplicate(modpackId);
      if (result?.id) {
        await refresh();
        onClose();
      }
    } catch (error) {
      console.error('Error duplicating modpack:', error);
      toast.error(t('modpacks.duplicate_error') || 'Ошибка при дублировании модпака');
    }
  };

  const loadMods = useCallback(async () => {
    if (activeTab !== 'mods') return;
    setLoadingMods(true);
    try {
      const modsList = await modpacksIPC.getMods(modpackId, minecraftPath);
      setMods(modsList);
    } catch (error) {
      console.error('Error loading mods:', error);
      setMods([]);
    } finally {
      setLoadingMods(false);
    }
  }, [activeTab, modpackId, minecraftPath]);

  useEffect(() => {
    if (activeTab === 'mods' && isOpen) {
      loadMods();
    }
  }, [activeTab, isOpen, loadMods]);

  if (!isOpen || !modpack) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={modpack.name} className="max-w-3xl">
      <div className="flex flex-col h-full max-h-[80vh] overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <LoadingSpinner size="lg" />
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{t('modpacks.loading')}</p>
          </div>
        ) : (
          <>
            {/* Header with icon and basic info */}
            <div className="flex items-start gap-4 mb-6 pb-4 border-b border-zinc-200 dark:border-zinc-700">
              {metadata?.iconUrl && (
                <img
                  src={metadata.iconUrl}
                  alt={modpack.name}
                  className="w-20 h-20 rounded-lg object-cover border border-zinc-200 dark:border-zinc-700"
                  onError={(e) => {
                    if (e.currentTarget.src !== '/icon.png') {
                      e.currentTarget.src = '/icon.png';
                    }
                  }}
                />
              )}
              <div className="flex-1 min-w-0">
                <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">
                  {modpack.name}
                </h3>
                {metadata && (
                  <div className="space-y-1 text-sm">
                    {metadata.version && (
                      <p className="text-zinc-600 dark:text-zinc-400">
                        {t('modpacks.version')}: {metadata.version}
                      </p>
                    )}
                    {metadata.minecraftVersion && (
                      <p className="text-zinc-600 dark:text-zinc-400">
                        {t('modpacks.minecraft_version')}: {metadata.minecraftVersion}
                      </p>
                    )}
                    {metadata.modLoader && (
                      <p className="text-zinc-600 dark:text-zinc-400">
                        {t('modpacks.loader')}: {metadata.modLoader.type}
                        {metadata.modLoader.version && ` ${metadata.modLoader.version}`}
                      </p>
                    )}
                    {metadata.author && (
                      <p className="text-zinc-600 dark:text-zinc-400">
                        {t('modpacks.author')}: {metadata.author}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-4 border-b border-zinc-200 dark:border-zinc-700">
              <button
                onClick={() => setActiveTab('info')}
                className={cn(
                  'px-4 py-2 text-sm font-medium transition-colors border-b-2',
                  activeTab === 'info'
                    ? cn('border-opacity-100', getAccentStyles('border').className)
                    : 'border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300'
                )}
                style={activeTab === 'info' ? { borderColor: getAccentHex() } : undefined}
              >
                {t('modpacks.tab_info') || 'Информация'}
              </button>
              <button
                onClick={() => setActiveTab('mods')}
                className={cn(
                  'px-4 py-2 text-sm font-medium transition-colors border-b-2',
                  activeTab === 'mods'
                    ? cn('border-opacity-100', getAccentStyles('border').className)
                    : 'border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300'
                )}
                style={activeTab === 'mods' ? { borderColor: getAccentHex() } : undefined}
              >
                {t('modpacks.tab_mods') || 'Моды'}
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                className={cn(
                  'px-4 py-2 text-sm font-medium transition-colors border-b-2',
                  activeTab === 'settings'
                    ? cn('border-opacity-100', getAccentStyles('border').className)
                    : 'border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300'
                )}
                style={activeTab === 'settings' ? { borderColor: getAccentHex() } : undefined}
              >
                {t('modpacks.tab_settings') || 'Настройки'}
              </button>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {activeTab === 'info' && (
                <div className="space-y-4">
                  {metadata?.description && (
                    <div>
                      <h4 className="text-sm font-semibold text-zinc-900 dark:text-white mb-2">
                        {t('modpacks.description')}
                      </h4>
                      <p className="text-sm text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap">
                        {metadata.description}
                      </p>
                    </div>
                  )}
                  {metadata?.source && (
                    <div>
                      <h4 className="text-sm font-semibold text-zinc-900 dark:text-white mb-2">
                        {t('modpacks.source') || 'Источник'}
                      </h4>
                      <p className="text-sm text-zinc-600 dark:text-zinc-400 capitalize">
                        {metadata.source === 'curseforge' ? t('modpacks.platform_curseforge') : 
                         metadata.source === 'modrinth' ? t('modpacks.platform_modrinth') : 
                         t('modpacks.platform_local')}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'mods' && (
                <div className="space-y-4">
                  {loadingMods ? (
                    <div className="flex flex-col items-center justify-center py-8 gap-3">
                      <LoadingSpinner size="md" />
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">
                        {t('modpacks.loading')}
                      </p>
                    </div>
                  ) : mods.length === 0 ? (
                    <div className="text-center py-8 text-zinc-500 dark:text-zinc-400">
                      <p>{t('modpacks.no_mods') || 'В модпаке нет модов'}</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex justify-between items-center mb-2">
                        <p className="text-sm font-semibold text-zinc-900 dark:text-white">
                          {t('modpacks.mods_count') || 'Моды'} ({mods.length})
                        </p>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => setShowAddModModal(true)}
                          style={getAccentStyles('bg').style}
                        >
                          {t('modpacks.add_mod') || 'Добавить мод'}
                        </Button>
                      </div>
                      <div className="space-y-2">
                        {mods.map((mod) => (
                          <div
                            key={mod.id}
                            className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-700"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <h5 className="font-medium text-zinc-900 dark:text-white truncate">
                                  {mod.name}
                                </h5>
                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                                    {t('modpacks.version')}: {mod.version}
                                  </span>
                                  {mod.loaders.length > 0 && (
                                    <span className="text-xs px-2 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300">
                                      {mod.loaders.join(', ')}
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 truncate">
                                  {mod.file.name}
                                </p>
                                <div className="flex gap-2 mt-2">
                                  <a
                                    href={`https://modrinth.com/mod/${mod.name.toLowerCase().replace(/\s+/g, '-')}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    Modrinth
                                  </a>
                                  <a
                                    href={`https://www.curseforge.com/minecraft/mc-mods/${mod.name.toLowerCase().replace(/\s+/g, '-')}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-orange-600 dark:text-orange-400 hover:underline"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    CurseForge
                                  </a>
                                </div>
                              </div>
                              <Button
                                variant="danger"
                                size="sm"
                                onClick={async () => {
                                  const confirmed = await confirm.confirm({
                                    title: t('modpacks.remove') || 'Удалить мод',
                                    message: t('modpacks.remove_mod_confirm')?.replace('{{name}}', mod.name) || `Удалить мод "${mod.name}"?`,
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
                                }}
                              >
                                {t('modpacks.remove') || 'Удалить'}
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'settings' && (
                <div className="space-y-4">
                  {modpackConfig ? (
                    <GameTab
                      modpackConfig={modpackConfig}
                      setMemoryGb={handleSetMemoryGb}
                      setJavaPath={handleSetJavaPath}
                      setVmOptions={handleSetVmOptions}
                      setGameExtraArgs={handleSetGameExtraArgs}
                      setGameResolution={handleSetGameResolution}
                      setAutoConnectServer={handleSetAutoConnectServer}
                      refreshInstances={async () => {
                        await refresh();
                        await loadModpackConfig();
                      }}
                      minecraftPath={minecraftPath}
                      setMinecraftPath={() => {}}
                      t={t}
                      getAccentStyles={getAccentStyles}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 gap-3">
                      <LoadingSpinner size="md" />
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">
                        {t('modpacks.loading')}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2 mt-6 pt-4 border-t border-zinc-200 dark:border-zinc-700">
              <Button
                variant="primary"
                onClick={handleLaunch}
                className="flex-1"
                style={getAccentStyles('bg').style}
              >
                {t('general.play')}
              </Button>
              {hasUpdate && metadata?.source && metadata?.sourceId && (
                <Button
                  variant="primary"
                  onClick={() => setShowUpdateModal(true)}
                  className={cn(getAccentStyles('bg').className)}
                  style={getAccentStyles('bg').style}
                >
                  {t('modpacks.update_available') || 'Обновление доступно'}
                </Button>
              )}
              <Button variant="secondary" onClick={handleDuplicate}>
                {t('modpacks.duplicate')}
              </Button>
              <Button variant="secondary" onClick={handleExport}>
                {t('modpacks.export') || 'Экспорт'}
              </Button>
              {modpacks.length > 1 && (
                <Button variant="danger" onClick={handleDelete}>
                  {t('modpacks.delete')}
                </Button>
              )}
            </div>
          </>
        )}
      </div>

      {showExportModal && (
        <ExportModpackModal
          modpackId={modpackId}
          modpackName={modpack?.name || ''}
          isOpen={showExportModal}
          onClose={() => setShowExportModal(false)}
          onExported={() => {
            toast.success(t('modpacks.export_success') || 'Модпак успешно экспортирован!');
          }}
        />
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

      {showAddModModal && (
        <AddModModal
          modpackId={modpackId}
          isOpen={showAddModModal}
          onClose={() => setShowAddModModal(false)}
          onAdded={async () => {
            await loadMods();
          }}
        />
      )}
    </Modal>
  );
};
