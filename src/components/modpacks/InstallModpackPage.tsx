import React, { useState, useEffect } from 'react';
import { useSettings } from '../../contexts/SettingsContext';
import { useToast } from '../../contexts/ToastContext';
import { Button } from '../ui/Button';
import { LazyImage } from '../ui/LazyImage';
import { ProgressBar } from '../ui/ProgressBar';
import { Select } from '../ui/Select';
import { cn } from '../../utils/cn';
import type { ModpackSearchResultItem, ModpackVersionDescriptor, ModpackInstallProgress } from '@shared/contracts';
import { modpacksIPC } from '../../services/ipc/modpacksIPC';
import { ArrowLeft } from 'lucide-react';

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
      }, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('modpacks.install_error'));
      setInstalling(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="border-b border-border/70 bg-card/78 px-6 py-4 backdrop-blur-md">
        <div className="flex flex-wrap items-center gap-4">
          <Button
            variant="secondary"
            size="sm"
            onClick={onBack}
            className="flex items-center gap-2"
            disabled={installing}
          >
            <ArrowLeft className="h-4 w-4" />
            {t('general.back') || 'Назад'}
          </Button>
          <div className="min-w-0 flex-1">
            <div className="kicker-label">{t('modpacks.browser')}</div>
            <h2 className="text-xl font-bold text-foreground">
              {t('modpacks.install') || 'Установить модпак'}
            </h2>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 min-h-0">
        <div className="space-y-4 max-w-2xl mx-auto">
          {/* Modpack Info */}
          <div className="surface-card flex gap-4 p-5">
            <LazyImage
              src={modpack.iconUrl}
              alt={modpack.title}
              className="h-20 w-20 rounded-2xl border border-border/70 object-cover"
            />
            <div className="flex-1">
              <h3 className="text-lg font-bold text-foreground">{modpack.title}</h3>
              {modpack.description && (
                <p className="mt-1 line-clamp-2 text-sm text-secondary">
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
            <div className="surface-muted grid grid-cols-2 gap-4 p-4">
              <div>
                <p className="mb-1 text-xs text-secondary">
                  {t('modpacks.minecraft_version')}
                </p>
                <p className="font-mono text-sm font-bold text-foreground">
                  {selectedVersion.mcVersions[0] || '—'}
                </p>
              </div>
              <div>
                <p className="mb-1 text-xs text-secondary">
                  {t('modpacks.loader')}
                </p>
                <p className="font-mono text-sm font-bold text-foreground">
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
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3">
              <p className="text-sm text-emerald-700 dark:text-emerald-300">
                {t('modpacks.install_success')}
              </p>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-3">
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="surface-inline flex gap-3 pt-2">
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
