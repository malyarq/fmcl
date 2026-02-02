import React, { useState, useEffect } from 'react';
import { useSettings } from '../../contexts/SettingsContext';
import { useToast } from '../../contexts/ToastContext';
import { Button } from '../ui/Button';
import { ProgressBar } from '../ui/ProgressBar';
import { Select } from '../ui/Select';
import { cn } from '../../utils/cn';
import type { ModpackSearchResultItem, ModpackVersionDescriptor, ModpackInstallProgress } from '@shared/contracts';
import { modpacksIPC } from '../../services/ipc/modpacksIPC';

interface InstallModpackPageProps {
  modpack: ModpackSearchResultItem;
  versions: ModpackVersionDescriptor[];
  platform: 'curseforge' | 'modrinth';
  onBack: () => void;
}

export const InstallModpackPage: React.FC<InstallModpackPageProps> = ({
  modpack,
  versions,
  platform,
  onBack,
}) => {
  const { t, getAccentStyles } = useSettings();
  const toast = useToast();
  const [selectedVersion, setSelectedVersion] = useState<ModpackVersionDescriptor | null>(
    versions[0] || null
  );
  const [installing, setInstalling] = useState(false);
  const [progress, setProgress] = useState<ModpackInstallProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const handleProgress = (_event: unknown, ...args: unknown[]) => {
      const progressData = args[0] as ModpackInstallProgress;
      setProgress(progressData);
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
  }, []);

  const handleInstall = async () => {
    if (!selectedVersion) return;

    setInstalling(true);
    setError(null);
    setProgress({ downloaded: 0, total: 100, stage: t('modpacks.installing') });

    try {
      let result;

      if (platform === 'curseforge') {
        result = await modpacksIPC.installCurseForge(
          Number(modpack.projectId),
          Number(selectedVersion.versionId)
        );
      } else {
        result = await modpacksIPC.installModrinth(
          modpack.projectId,
          selectedVersion.versionId
        );
      }

      setSuccess(true);
      try {
        await modpacksIPC.setSelected(result.modpackId);
      } catch (err) {
        console.warn('Failed to select modpack:', err);
      }
      toast.success(t('modpacks.install_success') || 'Модпак успешно установлен!');
      setTimeout(() => {
        onBack();
        window.location.reload();
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('modpacks.install_error'));
      setInstalling(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header with back button */}
      <div className="flex items-center gap-4 p-6 border-b border-zinc-200 dark:border-zinc-700 bg-white/60 dark:bg-zinc-900/40">
        <Button
          variant="secondary"
          size="sm"
          onClick={onBack}
          className="flex items-center gap-2"
          disabled={installing}
        >
          <span>←</span>
          {t('general.back') || 'Назад'}
        </Button>
        <h2 className="text-xl font-bold text-zinc-900 dark:text-white flex-1">
          {t('modpacks.install') || 'Установить модпак'}
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto p-6 min-h-0">
        <div className="space-y-4 max-w-2xl mx-auto">
          {/* Modpack Info */}
          <div className="flex gap-4 p-4 bg-zinc-50 dark:bg-zinc-900/40 rounded-lg border border-zinc-200 dark:border-zinc-700">
            {modpack.iconUrl && (
              <img
                src={modpack.iconUrl}
                alt={modpack.title}
                className="w-20 h-20 rounded-lg object-cover"
              />
            )}
            <div className="flex-1">
              <h3 className="font-bold text-lg text-zinc-900 dark:text-white">{modpack.title}</h3>
              {modpack.description && (
                <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1 line-clamp-2">
                  {modpack.description}
                </p>
              )}
            </div>
          </div>

          {/* Version Selection */}
          {versions.length > 0 && (
            <Select
              label={t('modpacks.select_version')}
              value={selectedVersion?.versionId || ''}
              onChange={(e) => {
                const version = versions.find((v) => v.versionId === e.target.value);
                setSelectedVersion(version || null);
              }}
              disabled={installing}
            >
              {versions.map((version) => (
                <option key={version.versionId} value={version.versionId}>
                  {version.name} {version.mcVersions.length > 0 && `(${version.mcVersions[0]})`}
                </option>
              ))}
            </Select>
          )}

          {/* Version Info */}
          {selectedVersion && (
            <div className="grid grid-cols-2 gap-4 p-4 bg-zinc-50 dark:bg-zinc-900/40 rounded-lg border border-zinc-200 dark:border-zinc-700">
              <div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">
                  {t('modpacks.minecraft_version')}
                </p>
                <p className="font-mono font-bold text-sm text-zinc-900 dark:text-white">
                  {selectedVersion.mcVersions[0] || '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">
                  {t('modpacks.loader')}
                </p>
                <p className="font-mono font-bold text-sm text-zinc-900 dark:text-white">
                  {selectedVersion.loaders.join(', ') || '—'}
                </p>
              </div>
            </div>
          )}

          {/* Progress */}
          {installing && progress && (
            <ProgressBar
              value={progress.total > 0 ? (progress.downloaded / progress.total) * 100 : 0}
              label={progress.stage}
              valueLabel={progress.total > 0 ? `${Math.round((progress.downloaded / progress.total) * 100)}%` : '0%'}
              animated
            />
          )}

          {/* Success Message */}
          {success && (
            <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
              <p className="text-sm text-green-700 dark:text-green-300">
                {t('modpacks.install_success')}
              </p>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <Button
              onClick={onBack}
              variant="secondary"
              disabled={installing}
              className="flex-1"
            >
              {t('general.cancel')}
            </Button>
            <Button
              onClick={handleInstall}
              disabled={!selectedVersion || installing || success}
              className={cn("flex-1 text-white", getAccentStyles('bg').className)}
              style={getAccentStyles('bg').style}
            >
              {installing ? t('modpacks.installing') : t('modpacks.install')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
