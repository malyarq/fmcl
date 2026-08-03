import React, { useEffect, useRef, useState } from 'react';
import { useSettings } from '../../contexts/SettingsContext';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { Select } from '../ui/Select';
import { cn } from '../../utils/cn';
import type { ModpackSearchResultItem, ModpackVersionDescriptor } from '@shared/contracts';
import { modpacksIPC } from '../../services/ipc/modpacksIPC';
import { ProviderInstallOperationState } from './ProviderInstallOperationState';
import {
  hasPublishedProviderInstance,
  isPublishedProviderInstall,
  isProviderInstallTerminal,
  useProviderInstallOperation,
} from './useProviderInstallOperation';

interface InstallModpackModalProps {
  isOpen: boolean;
  onClose: () => void;
  modpack: ModpackSearchResultItem;
  versions: ModpackVersionDescriptor[];
  platform: 'curseforge' | 'modrinth';
}

export const InstallModpackModal: React.FC<InstallModpackModalProps> = ({
  isOpen,
  onClose,
  modpack,
  versions,
  platform,
}) => {
  const { t, getAccentStyles } = useSettings();
  const [selectedVersion, setSelectedVersion] = useState<ModpackVersionDescriptor | null>(
    versions[0] || null
  );
  const { operation, error, isActive, start, cancel } = useProviderInstallOperation(isOpen);
  const completedOperationRef = useRef<string | null>(null);

  useEffect(() => {
    if (!operation || !isProviderInstallTerminal(operation) || completedOperationRef.current === operation.id) return;
    completedOperationRef.current = operation.id;
    if (!isPublishedProviderInstall(operation)) return;

    if (hasPublishedProviderInstance(operation)) {
      void modpacksIPC.setSelected(operation.result.instanceId).catch((nextError) => {
        console.warn('Failed to select modpack:', nextError);
      });
    }
    window.setTimeout(onClose, 2000);
  }, [onClose, operation]);

  const handleInstall = async () => {
    if (!selectedVersion) return;

    if (platform === 'curseforge') {
      await start({ kind: 'install-curseforge', projectId: Number(modpack.projectId), fileId: Number(selectedVersion.versionId) });
      return;
    }
    await start({ kind: 'install-modrinth', projectId: modpack.projectId, versionId: selectedVersion.versionId });
  };


  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('modpacks.install')}
      className="max-w-2xl"
    >
      <div className="space-y-4">
        {/* Modpack Info */}
        <div className="surface-soft flex gap-4 p-4">
          {modpack.iconUrl && (
            <img
              src={modpack.iconUrl}
              alt={modpack.title}
              className="h-20 w-20 rounded-lg border border-border/60 object-cover"
            />
          )}
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
          <div className="surface-soft grid grid-cols-2 gap-4 p-4">
            <div>
              <p className="helper-text mb-1">
                {String(t('modpacks.minecraft_version'))}
              </p>
              <p className="text-sm font-mono font-bold text-foreground">
                {selectedVersion.mcVersions[0] || '—'}
              </p>
            </div>
            <div>
              <p className="helper-text mb-1">
                {String(t('modpacks.loader'))}
              </p>
              <p className="text-sm font-mono font-bold text-foreground">
                {selectedVersion.loaders.join(', ') || '—'}
              </p>
            </div>
          </div>
        ) : null) as React.ReactNode}

        {operation && <ProviderInstallOperationState operation={operation} t={t} />}

        {error ? (
          <div className="rounded-lg border border-[rgb(var(--color-error))]/25 bg-[rgb(var(--color-error))]/10 p-3">
            <p className="text-sm text-[rgb(var(--color-error))]">{error instanceof Error ? error.message : t('modpacks.install_error')}</p>
          </div>
        ) : null}

        {/* Action Buttons */}
        <div className="flex gap-3 pt-2">
          <Button
            onClick={() => {
              if (isActive) void cancel();
              else onClose();
            }}
            variant="secondary"
            disabled={operation?.status === 'cancelling'}
            className="flex-1"
          >
            {t('general.cancel')}
          </Button>
          <Button
            onClick={() => {
              if (isActive) void cancel();
              else void handleInstall();
            }}
            disabled={!selectedVersion || operation?.status === 'cancelling'}
            className={cn("flex-1 text-[rgb(var(--accent-content))]", getAccentStyles('bg').className)}
            style={getAccentStyles('bg').style}
          >
            {isActive ? t('general.cancel') : t('modpacks.install')}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
