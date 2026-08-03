import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSettings } from '../../contexts/SettingsContext';
import { useToast } from '../../contexts/ToastContext';
import { Button } from '../ui/Button';
import { DegradedStateView } from '../layout/DegradedStateView';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { Modal } from '../ui/Modal';
import { Select } from '../ui/Select';
import { modpacksIPC } from '../../services/ipc/modpacksIPC';
import type { ModpackVersionDescriptor } from '@shared/contracts';
import { toDisplayErrorMessage } from '../../utils/displayError';
import { isSuspiciousUiText, sanitizeUiText } from '../../utils/safeUiText';
import { ProviderInstallOperationState } from './ProviderInstallOperationState';
import {
  isPublishedProviderInstall,
  isProviderInstallTerminal,
  useProviderInstallOperation,
} from './useProviderInstallOperation';

interface ModpackUpdateModalProps {
  modpackId: string;
  sourceId: string;
  source: 'curseforge' | 'modrinth';
  currentVersion?: string;
  isOpen: boolean;
  onClose: () => void;
  onUpdated?: () => void;
}

function getSafeVersionLabel(version: ModpackVersionDescriptor, fallback: string) {
  return sanitizeUiText(
    version.name,
    sanitizeUiText(version.versionNumber, sanitizeUiText(version.versionId, fallback)),
  );
}

function getChangelogState(version: ModpackVersionDescriptor | undefined) {
  const rawChangelog = version?.changelog?.trim() ?? '';

  if (!rawChangelog) {
    return { kind: 'empty' as const };
  }

  if (isSuspiciousUiText(rawChangelog)) {
    return { kind: 'unavailable' as const };
  }

  return {
    kind: 'value' as const,
    value: rawChangelog,
  };
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
  const [loadError, setLoadError] = useState<string | null>(null);
  const { operation, error: operationError, isActive, start, cancel } = useProviderInstallOperation(isOpen);
  const completedOperationRef = useRef<string | null>(null);

  useEffect(() => {
    if (!operation || !isProviderInstallTerminal(operation) || completedOperationRef.current === operation.id) return;
    completedOperationRef.current = operation.id;
    if (!isPublishedProviderInstall(operation)) return;
    onUpdated?.();
    onClose();
  }, [onClose, onUpdated, operation]);

  const loadVersions = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    setVersions([]);
    setSelectedVersion('');

    try {
      const versionsList =
        source === 'curseforge'
          ? await modpacksIPC.getCurseForgeVersions(Number(sourceId))
          : await modpacksIPC.getModrinthVersions(sourceId);

      const availableVersions = versionsList.filter((version) => version.versionId !== currentVersion);
      setVersions(availableVersions);

      if (availableVersions.length > 0) {
        setSelectedVersion(availableVersions[0].versionId);
      }
    } catch (error) {
      console.error('Error loading versions:', error);
      setLoadError(toDisplayErrorMessage(error, t('error.inline_fallback')));
    } finally {
      setLoading(false);
    }
  }, [currentVersion, source, sourceId, t]);

  useEffect(() => {
    if (!isOpen) return;
    void loadVersions();
  }, [isOpen, loadVersions]);

  const handleUpdate = async () => {
    if (!selectedVersion) return;

    if (source === 'curseforge') {
      const version = versions.find((item) => item.versionId === selectedVersion);
      if (!version?.fileId) {
        toast.error(t('modpacks.update_error') || 'Ошибка при обновлении модпака');
        return;
      }
      await start({
        kind: 'install-curseforge',
        projectId: Number(sourceId),
        fileId: version.fileId,
        destinationId: modpackId,
        rootPath: minecraftPath,
      });
      return;
    }

    await start({
      kind: 'install-modrinth',
      projectId: sourceId,
      versionId: selectedVersion,
      destinationId: modpackId,
      rootPath: minecraftPath,
    });
  };

  if (!isOpen) return null;

  const selectedVersionDescriptor = versions.find((version) => version.versionId === selectedVersion);
  const changelogState = getChangelogState(selectedVersionDescriptor);
  const unavailableVersionLabel = t('modpacks.version_unavailable') || 'Version unavailable';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('modpacks.review_update_title') || 'Review modpack update'}>
      <div className="space-y-4" data-testid="modpack-update-modal" data-update-scope="modpack-local">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <LoadingSpinner size="lg" />
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {t('modpacks.loading')}
            </p>
          </div>
        ) : loadError ? (
          <DegradedStateView
            variant="error"
            layout="inline"
            label={t('degraded.error_label')}
            title={t('modpacks.update_unavailable_title') || 'Unable to load updates'}
            description={loadError}
            footer={(
              <Button variant="secondary" size="sm" onClick={() => void loadVersions()}>
                {t('modpacks.update')}
              </Button>
            )}
          />
        ) : versions.length === 0 ? (
          <DegradedStateView
            variant="empty"
            layout="inline"
            label={t('degraded.empty_label')}
            title={t('modpacks.no_updates_available') || 'No updates available'}
            description={
              t('modpacks.no_updates_available_desc') ||
              'This pack is already on the newest version we can verify right now.'
            }
          />
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
                    {getSafeVersionLabel(version, unavailableVersionLabel)} ({version.mcVersions.join(', ')})
                  </option>
                ))}
              </Select>
            </div>

            {selectedVersion && !isActive && (
              <div>
                <label className="block text-sm font-medium text-zinc-900 dark:text-white mb-2">
                  {t('modpacks.changelog') || 'Список изменений'}
                </label>
                {changelogState.kind === 'value' ? (
                  <textarea
                    value={changelogState.value}
                    placeholder={t('modpacks.changelog_placeholder') || 'Changelog will load here.'}
                    className="w-full h-32 p-3 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 text-sm text-zinc-900 dark:text-zinc-100 resize-none"
                    readOnly
                  />
                ) : (
                  <DegradedStateView
                    variant={changelogState.kind === 'empty' ? 'empty' : 'unavailable'}
                    layout="inline"
                    label={t(changelogState.kind === 'empty' ? 'degraded.empty_label' : 'degraded.unavailable_label')}
                    title={
                      changelogState.kind === 'empty'
                        ? t('modpacks.changelog_empty_title') || 'No changelog provided'
                        : t('modpacks.changelog_unavailable_title') || 'Changelog unavailable'
                    }
                    description={
                      changelogState.kind === 'empty'
                        ? t('modpacks.changelog_empty_desc') || 'This version does not include release notes.'
                        : t('modpacks.changelog_unavailable_desc') || 'We loaded the version, but its changelog is not safe to show.'
                    }
                  />
                )}
              </div>
            )}

            {operation && <ProviderInstallOperationState operation={operation} t={t} />}

            {operationError && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3" role="alert">
                {operationError instanceof Error ? operationError.message : t('modpacks.update_error')}
              </div>
            )}

            <div className="flex gap-2 pt-4 border-t border-zinc-200 dark:border-zinc-700">
              <Button
                variant="primary"
                onClick={() => {
                  if (isActive) void cancel();
                  else void handleUpdate();
                }}
                disabled={!selectedVersion || operation?.status === 'cancelling'}
                className="flex-1"
                style={getAccentStyles('bg').style}
                isLoading={isActive}
              >
                {isActive ? t('general.cancel') : t('modpacks.update') || 'Обновить'}
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  if (isActive) void cancel();
                  else onClose();
                }}
                disabled={operation?.status === 'cancelling'}
              >
                {t('general.cancel')}
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};
