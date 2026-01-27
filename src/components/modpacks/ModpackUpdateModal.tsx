import React, { useState, useEffect } from 'react';
import { useSettings } from '../../contexts/SettingsContext';
import { useToast } from '../../contexts/ToastContext';
import { Button } from '../ui/Button';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { Modal } from '../ui/Modal';
import { ProgressBar } from '../ui/ProgressBar';
import { Select } from '../ui/Select';
import { modpacksIPC } from '../../services/ipc/modpacksIPC';
import type { ModpackVersionDescriptor } from '@shared/contracts';

interface ModpackUpdateModalProps {
  modpackId: string;
  sourceId: string;
  source: 'curseforge' | 'modrinth';
  currentVersion?: string;
  isOpen: boolean;
  onClose: () => void;
  onUpdated?: () => void;
}

export const ModpackUpdateModal: React.FC<ModpackUpdateModalProps> = ({
  modpackId,
  sourceId,
  source,
  currentVersion,
  isOpen,
  onClose,
  onUpdated,
}) => {
  const { t, getAccentStyles, minecraftPath } = useSettings();
  const toast = useToast();
  const [versions, setVersions] = useState<ModpackVersionDescriptor[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [changelog, setChangelog] = useState<string>('');
  const [updateProgress, setUpdateProgress] = useState<{ downloaded: number; total: number; stage: string } | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Слушать события прогресса обновления
    const handleProgress = (_event: unknown, ...args: unknown[]) => {
      const progress = args[0] as { downloaded: number; total: number; stage: string };
      setUpdateProgress(progress);
    };

    const ipcRenderer = window.api?.ipcRenderer;
    if (ipcRenderer) {
      ipcRenderer.on('modpacks:updateProgress', handleProgress);
    }

    return () => {
      if (ipcRenderer) {
        ipcRenderer.off('modpacks:updateProgress', handleProgress);
      }
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const loadVersions = async () => {
      setLoading(true);
      try {
        let versionsList: ModpackVersionDescriptor[];
        
        if (source === 'curseforge') {
          versionsList = await modpacksIPC.getCurseForgeVersions(Number(sourceId));
        } else {
          versionsList = await modpacksIPC.getModrinthVersions(sourceId);
        }
        
        // Filter out current version
        const availableVersions = versionsList.filter((v) => v.versionId !== currentVersion);
        setVersions(availableVersions);
        
        if (availableVersions.length > 0) {
          setSelectedVersion(availableVersions[0].versionId);
          // Load changelog for first version
          if (availableVersions[0].changelog) {
            setChangelog(availableVersions[0].changelog);
          }
        }
      } catch (error) {
        console.error('Error loading versions:', error);
      } finally {
        setLoading(false);
      }
    };

    loadVersions();
  }, [isOpen, sourceId, source, currentVersion]);

  // Update changelog when selected version changes
  useEffect(() => {
    if (selectedVersion) {
      const version = versions.find((v) => v.versionId === selectedVersion);
      if (version?.changelog) {
        setChangelog(version.changelog);
      } else {
        setChangelog('');
      }
    }
  }, [selectedVersion, versions]);

  const handleUpdate = async () => {
    if (!selectedVersion) return;

    setUpdating(true);
    setUpdateProgress(null);
    try {
      // Создать резервную копию перед обновлением
      setUpdateProgress({ downloaded: 0, total: 100, stage: t('modpacks.backing_up') || 'Создание резервной копии...' });
      try {
        const backup = await modpacksIPC.backup(modpackId, minecraftPath);
        console.log('Backup created:', backup.backupPath);
      } catch (backupError) {
        console.error('Error creating backup:', backupError);
        // Продолжить обновление даже если бэкап не удался
      }

      if (source === 'curseforge') {
        // For CurseForge, we need fileId from the version
        const version = versions.find((v) => v.versionId === selectedVersion);
        if (!version || !version.fileId) {
          throw new Error('Invalid version: fileId is missing');
        }
        await modpacksIPC.installCurseForge(Number(sourceId), version.fileId, modpackId, minecraftPath);
      } else {
        await modpacksIPC.installModrinth(sourceId, selectedVersion, modpackId, minecraftPath);
      }
      
      setUpdateProgress(null);
      onUpdated?.();
      onClose();
    } catch (error) {
      console.error('Error updating modpack:', error);
      setUpdateProgress(null);
      toast.error(t('modpacks.update_error') || 'Ошибка при обновлении модпака');
    } finally {
      setUpdating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('modpacks.update_title') || 'Обновление модпака'}>
      <div className="space-y-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <LoadingSpinner size="lg" />
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {t('modpacks.loading')}
            </p>
          </div>
        ) : versions.length === 0 ? (
          <div className="text-center py-8 text-zinc-500 dark:text-zinc-400">
            {t('modpacks.no_updates_available') || 'Нет доступных обновлений'}
          </div>
        ) : (
          <>
            <div>
              <label className="block text-sm font-medium text-zinc-900 dark:text-white mb-2">
                {t('modpacks.select_version')}
              </label>
              <Select
                value={selectedVersion}
                onChange={(e) => setSelectedVersion(e.target.value)}
                className="w-full"
              >
                {versions.map((version) => (
                  <option key={version.versionId} value={version.versionId}>
                    {version.name} ({version.mcVersions.join(', ')})
                  </option>
                ))}
              </Select>
            </div>

            {selectedVersion && !updating && (
              <div>
                <label className="block text-sm font-medium text-zinc-900 dark:text-white mb-2">
                  {t('modpacks.changelog') || 'Список изменений'}
                </label>
                <textarea
                  value={changelog}
                  onChange={(e) => setChangelog(e.target.value)}
                  placeholder={t('modpacks.changelog_placeholder') || 'Changelog будет загружен...'}
                  className="w-full h-32 p-3 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 text-sm text-zinc-900 dark:text-zinc-100 resize-none"
                  readOnly
                />
              </div>
            )}

            {updating && updateProgress && (
              <ProgressBar
                value={(updateProgress.downloaded / updateProgress.total) * 100}
                label={updateProgress.stage}
                valueLabel={`${Math.round((updateProgress.downloaded / updateProgress.total) * 100)}%`}
                animated
              />
            )}

            <div className="flex gap-2 pt-4 border-t border-zinc-200 dark:border-zinc-700">
              <Button
                variant="primary"
                onClick={handleUpdate}
                disabled={!selectedVersion || updating}
                className="flex-1"
                style={getAccentStyles('bg').style}
                isLoading={updating}
              >
                {updating ? t('modpacks.updating') || 'Обновление...' : t('modpacks.update') || 'Обновить'}
              </Button>
              <Button variant="secondary" onClick={onClose}>
                {t('general.cancel')}
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};
