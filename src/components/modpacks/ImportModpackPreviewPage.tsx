import React from 'react';
import { useSettings } from '../../contexts/SettingsContext';
import { useToast } from '../../contexts/ToastContext';
import { Button } from '../ui/Button';
import { DegradedStateView } from '../layout/DegradedStateView';
import { cn } from '../../utils/cn';
import type { ArchiveManifestMetadata } from '@shared/contracts/archiveInspection';
import { useInstanceInvalidation } from '../../features/instances/hooks/useInstanceInvalidation';
import { useOperationSession } from '../../features/operations/hooks/useOperationSession';
import { OperationStatusView } from '../../features/operations/components/OperationStatusView';

interface ImportModpackPreviewPageProps {
  archiveRef: string;
  inspection: ArchiveManifestMetadata;
  onBack: () => void;
}

export const ImportModpackPreviewPage: React.FC<ImportModpackPreviewPageProps> = ({
  archiveRef,
  inspection,
  onBack,
}) => {
  const { t, getAccentStyles, formatNumber } = useSettings();
  const toast = useToast();
  const { invalidateInstances } = useInstanceInvalidation();
  const operation = useOperationSession({
    onCommitted: async ({ classification }) => {
      if (classification.shouldInvalidateInstances) await invalidateInstances();
    },
    onTerminal: ({ classification }) => {
      if (classification.isPresentationSuccess) {
        toast.success(t('modpacks.import_success') || 'Modpack imported successfully!');
      }
    },
  });
  const importing = operation.isStarting || operation.isActive;

  const handleImport = async () => {
    await operation.start({ kind: 'import', archiveRef });
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header with back button */}
      <div className="flex items-center gap-4 border-b border-border/70 bg-card/78 p-6 backdrop-blur-md">
        <Button
          variant="secondary"
          size="sm"
          onClick={onBack}
          className="flex items-center gap-2"
          disabled={importing}
        >
          <span>←</span>
          {t('general.back') || 'Назад'}
        </Button>
        <h2 className="flex-1 text-xl font-bold text-foreground">
          {t('modpacks.import_preview') || 'Предпросмотр модпака'}
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto p-6 min-h-0">
        <div className="space-y-4 max-w-2xl mx-auto">
          {inspection.error ? (
            <DegradedStateView
              variant="error"
              label={t('degraded.error_label')}
              title={t('modpacks.unable_to_load_info') || 'Unable to load modpack information'}
              description={inspection.error}
              footer={(
                <Button variant="secondary" size="sm" onClick={onBack}>
                  {t('general.back') || 'Back'}
                </Button>
              )}
            />
          ) : inspection.manifest ? (
            <>
              <OperationStatusView
                snapshot={operation.snapshot}
                classification={operation.classification}
                error={operation.error}
                errorFallback={t('modpacks.import_error') || 'Import failed'}
                onCancel={operation.cancel}
                t={t}
                testId="import-operation-status"
              />
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
                        {formatNumber(inspection.manifest.files.length)} {t('modpacks.mods') || 'модов'}
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
                          inspection.format === 'multimc' ? 'MultiMC / Prism / Burrow' :
                            inspection.format || 'Unknown'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 border-t border-border/70 pt-2">
                <Button
                  onClick={onBack}
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
                  disabled={importing || Boolean(operation.snapshot) || Boolean(operation.error)}
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
      </div>
    </div>
  );
};
