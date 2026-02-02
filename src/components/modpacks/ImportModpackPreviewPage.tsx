import React, { useState, useEffect } from 'react';
import { useSettings } from '../../contexts/SettingsContext';
import { useToast } from '../../contexts/ToastContext';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { Button } from '../ui/Button';
import { cn } from '../../utils/cn';
import { modpacksIPC } from '../../services/ipc/modpacksIPC';
import type { ModpackManifest } from '@shared/types/modpack';

interface ImportModpackPreviewPageProps {
  filePath: string;
  onBack: () => void;
}

const path = {
  basename: (filePath: string) => {
    const parts = filePath.split(/[/\\]/);
    return parts[parts.length - 1] || filePath;
  },
};

export const ImportModpackPreviewPage: React.FC<ImportModpackPreviewPageProps> = ({
  filePath,
  onBack,
}) => {
  const { t, getAccentStyles } = useSettings();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [info, setInfo] = useState<{
    format: 'curseforge' | 'modrinth' | 'zip' | null;
    manifest: ModpackManifest | null;
    error?: string;
  } | null>(null);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
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
  }, [filePath]);

  const handleImport = async () => {
    setImporting(true);
    try {
      await modpacksIPC.import(filePath);
      toast.success(t('modpacks.import_success') || 'Модпак успешно импортирован!');
      setTimeout(() => {
        onBack();
        window.location.reload();
      }, 1000);
    } catch (error) {
      console.error('Error importing modpack:', error);
      toast.error(t('modpacks.import_error') || 'Ошибка при импорте модпака');
    } finally {
      setImporting(false);
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
          disabled={importing}
        >
          <span>←</span>
          {t('general.back') || 'Назад'}
        </Button>
        <h2 className="text-xl font-bold text-zinc-900 dark:text-white flex-1">
          {t('modpacks.import_preview') || 'Предпросмотр модпака'}
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto p-6 min-h-0">
        <div className="space-y-4 max-w-2xl mx-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <LoadingSpinner size="lg" />
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                {t('modpacks.loading')}
              </p>
            </div>
          ) : info?.error ? (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-700 dark:text-red-300">{info.error}</p>
            </div>
          ) : info?.manifest ? (
            <>
              <div className="p-4 bg-zinc-50 dark:bg-zinc-900/40 rounded-lg border border-zinc-200 dark:border-zinc-700">
                <h3 className="font-bold text-lg text-zinc-900 dark:text-white mb-4">
                  {info.manifest.name || path.basename(filePath)}
                </h3>
                
                <div className="space-y-3">
                  {info.manifest.version && (
                    <div>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">
                        {t('modpacks.version')}
                      </p>
                      <p className="text-sm font-medium text-zinc-900 dark:text-white">
                        {info.manifest.version}
                      </p>
                    </div>
                  )}

                  {info.manifest.minecraft?.version && (
                    <div>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">
                        {t('modpacks.minecraft_version')}
                      </p>
                      <p className="text-sm font-medium text-zinc-900 dark:text-white">
                        {info.manifest.minecraft.version}
                      </p>
                    </div>
                  )}

                  {info.manifest.minecraft?.modLoaders && info.manifest.minecraft.modLoaders.length > 0 && (
                    <div>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">
                        {t('modpacks.loader')}
                      </p>
                      <p className="text-sm font-medium text-zinc-900 dark:text-white">
                        {info.manifest.minecraft.modLoaders
                          .map((loader) => loader.id.replace(/^(forge|fabric|quilt|neoforge)-/, ''))
                          .join(', ')}
                      </p>
                    </div>
                  )}

                  {info.manifest.author && (
                    <div>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">
                        {t('modpacks.author')}
                      </p>
                      <p className="text-sm font-medium text-zinc-900 dark:text-white">
                        {info.manifest.author}
                      </p>
                    </div>
                  )}

                  {info.manifest.files && info.manifest.files.length > 0 && (
                    <div>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">
                        {t('modpacks.mods_count')}
                      </p>
                      <p className="text-sm font-medium text-zinc-900 dark:text-white">
                        {info.manifest.files.length} {t('modpacks.mods') || 'модов'}
                      </p>
                    </div>
                  )}

                  <div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">
                      {t('modpacks.format') || 'Формат'}
                    </p>
                    <p className="text-sm font-medium text-zinc-900 dark:text-white capitalize">
                      {info.format === 'curseforge' ? t('modpacks.platform_curseforge') :
                       info.format === 'modrinth' ? t('modpacks.platform_modrinth') :
                       info.format || 'Unknown'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-2 border-t border-zinc-200 dark:border-zinc-700">
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
                  className={cn("flex-1 text-white", getAccentStyles('bg').className)}
                  style={getAccentStyles('bg').style}
                  isLoading={importing}
                >
                  {t('modpacks.import') || 'Импортировать'}
                </Button>
              </div>
            </>
          ) : (
            <div className="text-center py-8 text-zinc-500 dark:text-zinc-400">
              <p>{t('modpacks.unable_to_load_info') || 'Не удалось загрузить информацию о модпаке'}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
