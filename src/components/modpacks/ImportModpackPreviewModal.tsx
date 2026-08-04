import React, { useCallback } from 'react';
import { useSettings } from '../../contexts/SettingsContext';
import { useModpackListContext } from '../../contexts/ModpackContext';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { cn } from '../../utils/cn';
import type { ArchiveManifestMetadata } from '@shared/contracts/archiveInspection';
import { ImportOperationStatus } from './ImportOperationStatus';
import { useArchiveImportOperation } from './useArchiveImportOperation';

interface ImportModpackPreviewModalProps {
  archiveRef: string;
  inspection: ArchiveManifestMetadata;
  isOpen: boolean;
  onClose: () => void;
  onImport: () => void;
}

export const ImportModpackPreviewModal: React.FC<ImportModpackPreviewModalProps> = ({
  archiveRef,
  inspection,
  isOpen,
  onClose,
  onImport,
}) => {
  const { t, getAccentStyles } = useSettings();
  const { refresh } = useModpackListContext();
  const onPublished = useCallback(async () => {
    await refresh();
    onImport();
  }, [onImport, refresh]);
  const { operation, error: operationError, isActive: importing, start } = useArchiveImportOperation({
    archiveRef,
    enabled: isOpen,
    onPublished,
  });

  const handleImport = async () => {
    await start();
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      closeDisabled={importing}
      title={t('modpacks.import_preview') || 'Предпросмотр модпака'}
      className="max-w-2xl"
    >
      <div className="space-y-4">
        {inspection.error ? (
          <div className="rounded-lg border border-[rgb(var(--color-error))]/25 bg-[rgb(var(--color-error))]/10 p-4">
            <p className="text-sm text-[rgb(var(--color-error))]">{inspection.error}</p>
          </div>
        ) : inspection.manifest ? (
          <>
            <ImportOperationStatus operation={operation} error={operationError} t={t} />
            <div className="surface-soft p-4">
              <h3 className="mb-4 text-lg font-bold text-foreground">
                {inspection.manifest.name || t('modpacks.import_preview') || 'Import preview'}
              </h3>
              
              <div className="space-y-3">
                {inspection.manifest.version && (
                  <div>
                    <p className="helper-text mb-1">
                      {t('modpacks.version')}
                    </p>
                    <p className="text-sm font-medium text-foreground">
                      {inspection.manifest.version}
                    </p>
                  </div>
                )}

                {inspection.manifest.minecraft?.version && (
                  <div>
                    <p className="helper-text mb-1">
                      {t('modpacks.minecraft_version')}
                    </p>
                    <p className="text-sm font-medium text-foreground">
                      {inspection.manifest.minecraft.version}
                    </p>
                  </div>
                )}

                {inspection.manifest.minecraft?.modLoaders && inspection.manifest.minecraft.modLoaders.length > 0 && (
                  <div>
                    <p className="helper-text mb-1">
                      {t('modpacks.loader')}
                    </p>
                    <p className="text-sm font-medium text-foreground">
                      {inspection.manifest.minecraft.modLoaders
                        .map((loader) => loader.id.replace(/^(forge|fabric|quilt|neoforge)-/, ''))
                        .join(', ')}
                    </p>
                  </div>
                )}

                {inspection.manifest.author && (
                  <div>
                    <p className="helper-text mb-1">
                      {t('modpacks.author')}
                    </p>
                    <p className="text-sm font-medium text-foreground">
                      {inspection.manifest.author}
                    </p>
                  </div>
                )}

                {inspection.manifest.files && inspection.manifest.files.length > 0 && (
                  <div>
                    <p className="helper-text mb-1">
                      {t('modpacks.mods_count')}
                    </p>
                    <p className="text-sm font-medium text-foreground">
                      {inspection.manifest.files.length} {t('modpacks.mods') || 'модов'}
                    </p>
                  </div>
                )}

                <div>
                  <p className="helper-text mb-1">
                    {t('modpacks.format') || 'Формат'}
                  </p>
                  <p className="text-sm font-medium text-foreground capitalize">
                  {inspection.format === 'curseforge' ? t('modpacks.platform_curseforge') :
                     inspection.format === 'modrinth' ? t('modpacks.platform_modrinth') :
                     inspection.format || 'Unknown'}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-2 border-t border-border/70 pt-2">
              <Button
                onClick={onClose}
                variant="secondary"
                className="flex-1"
                disabled={importing}
              >
                {t('general.cancel')}
              </Button>
              <Button
                onClick={handleImport}
                className={cn("flex-1 text-[rgb(var(--accent-content))]", getAccentStyles('bg').className)}
                style={getAccentStyles('bg').style}
                isLoading={importing}
              >
                {t('modpacks.import') || 'Импортировать'}
              </Button>
            </div>
          </>
        ) : (
          <div className="py-8 text-center text-secondary">
            <p>{t('modpacks.unable_to_load_info') || 'Не удалось загрузить информацию о модпаке'}</p>
          </div>
        )}
      </div>
    </Modal>
  );
};
