import React, { useState, useEffect, useCallback } from 'react';
import { useSettings } from '../../contexts/SettingsContext';
import { useModpackListContext } from '../../contexts/ModpackContext';
import { Modal } from '../ui/Modal';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { Button } from '../ui/Button';
import { cn } from '../../utils/cn';
import { modpacksIPC } from '../../services/ipc/modpacksIPC';
import type { ModpackManifest } from '@shared/types/modpack';
import { ImportOperationStatus } from './ImportOperationStatus';
import { useArchiveImportOperation } from './useArchiveImportOperation';

interface ImportModpackPreviewModalProps {
  filePath: string;
  isOpen: boolean;
  onClose: () => void;
  onImport: () => void;
}

export const ImportModpackPreviewModal: React.FC<ImportModpackPreviewModalProps> = ({
  filePath,
  isOpen,
  onClose,
  onImport,
}) => {
  const { t, getAccentStyles } = useSettings();
  const { refresh } = useModpackListContext();
  const [loading, setLoading] = useState(true);
  const [info, setInfo] = useState<{
    format: 'curseforge' | 'modrinth' | 'zip' | null;
    manifest: ModpackManifest | null;
    error?: string;
  } | null>(null);
  const onPublished = useCallback(async () => {
    await refresh();
    onImport();
  }, [onImport, refresh]);
  const { operation, error: operationError, isActive: importing, start } = useArchiveImportOperation({
    filePath,
    enabled: isOpen,
    onPublished,
  });

  useEffect(() => {
    if (!isOpen || !filePath) return;

    const loadInfo = async () => {
      setLoading(true);
      try {
        const result = await modpacksIPC.getModpackInfoFromFile(filePath);
        setInfo(result as typeof info);
      } catch (error) {
        console.error('Error loading modpack info:', error);
        setInfo({ format: null, manifest: null, error: error instanceof Error ? error.message : 'Unknown error' });
      } finally {
        setLoading(false);
      }
    };

    loadInfo();
  }, [isOpen, filePath]);

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
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <LoadingSpinner size="lg" />
            <p className="text-sm text-secondary">
              {t('modpacks.loading')}
            </p>
          </div>
        ) : info?.error ? (
          <div className="rounded-lg border border-[rgb(var(--color-error))]/25 bg-[rgb(var(--color-error))]/10 p-4">
            <p className="text-sm text-[rgb(var(--color-error))]">{info.error}</p>
          </div>
        ) : info?.manifest ? (
          <>
            <ImportOperationStatus operation={operation} error={operationError} t={t} />
            <div className="surface-soft p-4">
              <h3 className="mb-4 text-lg font-bold text-foreground">
                {info.manifest.name || path.basename(filePath)}
              </h3>
              
              <div className="space-y-3">
                {info.manifest.version && (
                  <div>
                    <p className="helper-text mb-1">
                      {t('modpacks.version')}
                    </p>
                    <p className="text-sm font-medium text-foreground">
                      {info.manifest.version}
                    </p>
                  </div>
                )}

                {info.manifest.minecraft?.version && (
                  <div>
                    <p className="helper-text mb-1">
                      {t('modpacks.minecraft_version')}
                    </p>
                    <p className="text-sm font-medium text-foreground">
                      {info.manifest.minecraft.version}
                    </p>
                  </div>
                )}

                {info.manifest.minecraft?.modLoaders && info.manifest.minecraft.modLoaders.length > 0 && (
                  <div>
                    <p className="helper-text mb-1">
                      {t('modpacks.loader')}
                    </p>
                    <p className="text-sm font-medium text-foreground">
                      {info.manifest.minecraft.modLoaders
                        .map((loader) => loader.id.replace(/^(forge|fabric|quilt|neoforge)-/, ''))
                        .join(', ')}
                    </p>
                  </div>
                )}

                {info.manifest.author && (
                  <div>
                    <p className="helper-text mb-1">
                      {t('modpacks.author')}
                    </p>
                    <p className="text-sm font-medium text-foreground">
                      {info.manifest.author}
                    </p>
                  </div>
                )}

                {info.manifest.files && info.manifest.files.length > 0 && (
                  <div>
                    <p className="helper-text mb-1">
                      {t('modpacks.mods_count')}
                    </p>
                    <p className="text-sm font-medium text-foreground">
                      {info.manifest.files.length} {t('modpacks.mods') || 'модов'}
                    </p>
                  </div>
                )}

                <div>
                  <p className="helper-text mb-1">
                    {t('modpacks.format') || 'Формат'}
                  </p>
                  <p className="text-sm font-medium text-foreground capitalize">
                    {info.format === 'curseforge' ? t('modpacks.platform_curseforge') :
                     info.format === 'modrinth' ? t('modpacks.platform_modrinth') :
                     info.format || 'Unknown'}
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

// Helper to get basename
const path = {
  basename: (filePath: string) => {
    const parts = filePath.split(/[/\\]/);
    return parts[parts.length - 1] || filePath;
  },
};
