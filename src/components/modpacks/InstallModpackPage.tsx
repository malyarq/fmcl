import React, { useEffect, useRef, useState } from 'react';
import { useSettings } from '../../contexts/SettingsContext';
import { useToast } from '../../contexts/ToastContext';
import { Button } from '../ui/Button';
import { LazyImage } from '../ui/LazyImage';
import { Select } from '../ui/Select';
import { cn } from '../../utils/cn';
import type { ModpackSearchResultItem, ModpackVersionDescriptor } from '@shared/contracts';
import { modpacksIPC } from '../../services/ipc/modpacksIPC';
import { ArrowLeft } from 'lucide-react';
import { ProviderInstallOperationState } from './ProviderInstallOperationState';
import {
  hasPublishedProviderInstance,
  isProviderInstallTerminal,
  useProviderInstallOperation,
} from './useProviderInstallOperation';

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
  const { operation, error, isActive, start, cancel } = useProviderInstallOperation();
  const completedOperationRef = useRef<string | null>(null);

  useEffect(() => {
    if (!operation || !isProviderInstallTerminal(operation) || completedOperationRef.current === operation.id) return;
    completedOperationRef.current = operation.id;

    if (!hasPublishedProviderInstance(operation)) return;

    void modpacksIPC.setSelected(operation.result.instanceId).catch((nextError) => {
      console.warn('Failed to select modpack:', nextError);
    });
    toast.success(t('modpacks.install_success'));
    window.setTimeout(onBack, 1200);
  }, [onBack, operation, t, toast]);

  const handleInstall = async () => {
    if (!selectedVersion) return;

    if (platform === 'curseforge') {
      await start({
        kind: 'install-curseforge',
        projectId: Number(modpack.projectId),
        fileId: Number(selectedVersion.versionId),
      });
      return;
    }

    await start({ kind: 'install-modrinth', projectId: modpack.projectId, versionId: selectedVersion.versionId });
  };

  const handleCancelOrBack = () => {
    if (isActive) {
      void cancel();
      return;
    }
    onBack();
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="border-b border-border/70 bg-card/78 px-6 py-4 backdrop-blur-md">
        <div className="flex flex-wrap items-center gap-4">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleCancelOrBack}
            className="flex items-center gap-2"
            disabled={operation?.status === 'cancelling'}
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
              disabled={isActive}
            >
              {versions.map((version) => (
                <option key={version.versionId} value={version.versionId}>
                  {version.name} {version.mcVersions.length > 0 && `(${version.mcVersions[0]})`}
                </option>
              ))}
            </Select>
          )}

          {(selectedVersion ? (
            <div className="surface-muted grid grid-cols-2 gap-4 p-4">
              <div>
                <p className="mb-1 text-xs text-secondary">
                  {String(t('modpacks.minecraft_version'))}
                </p>
                <p className="font-mono text-sm font-bold text-foreground">
                  {selectedVersion.mcVersions[0] || '—'}
                </p>
              </div>
              <div>
                <p className="mb-1 text-xs text-secondary">
                  {String(t('modpacks.loader'))}
                </p>
                <p className="font-mono text-sm font-bold text-foreground">
                  {selectedVersion.loaders.join(', ') || '—'}
                </p>
              </div>
            </div>
          ) : null) as React.ReactNode}

          {operation && <ProviderInstallOperationState operation={operation} t={t} />}

          {error ? (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-3">
              <p className="text-sm text-red-700 dark:text-red-300">{error instanceof Error ? error.message : t('modpacks.install_error')}</p>
            </div>
          ) : null}

          {/* Action Buttons */}
          <div className="surface-inline flex gap-3 pt-2">
            <Button
              onClick={handleCancelOrBack}
              variant="secondary"
              disabled={operation?.status === 'cancelling'}
              className="flex-1"
            >
              {t('general.cancel')}
            </Button>
            <Button
              onClick={isActive ? handleCancelOrBack : handleInstall}
              disabled={!selectedVersion || operation?.status === 'cancelling'}
              className={cn("flex-1 text-white", getAccentStyles('bg').className)}
              style={getAccentStyles('bg').style}
            >
              {isActive ? t('general.cancel') : t('modpacks.install')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
