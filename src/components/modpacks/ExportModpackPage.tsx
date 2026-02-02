import React, { useState, useEffect } from 'react';
import { useSettings } from '../../contexts/SettingsContext';
import { useToast } from '../../contexts/ToastContext';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { ErrorMessage } from '../ui/ErrorMessage';
import { modpacksIPC } from '../../services/ipc/modpacksIPC';
import { dialogIPC } from '../../services/ipc/dialogIPC';

interface ExportModpackPageProps {
  modpackId: string;
  onBack: () => void;
}

export const ExportModpackPage: React.FC<ExportModpackPageProps> = ({
  modpackId,
  onBack,
}) => {
  const { t, getAccentStyles, minecraftPath } = useSettings();
  const toast = useToast();
  const [modpackName, setModpackName] = useState('');
  const [format, setFormat] = useState<'curseforge' | 'modrinth' | 'zip'>('zip');
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [desktopPath, setDesktopPath] = useState<string | null>(null);
  const [outputPath, setOutputPath] = useState('');
  const [outputPathError, setOutputPathError] = useState<string | null>(null);

  useEffect(() => {
    const loadModpackName = async () => {
      try {
        const metadata = await modpacksIPC.getMetadata(modpackId, minecraftPath);
        setModpackName(metadata.name || '');
      } catch (error) {
        console.error('Error loading modpack name:', error);
      }
    };
    loadModpackName();
  }, [modpackId, minecraftPath]);

  useEffect(() => {
    if (!desktopPath) {
      dialogIPC.getDesktopPath()
        .then(path => {
          setDesktopPath(path);
          const fileName = `${modpackName || 'modpack'}.${getFileExtension(format)}`;
          setOutputPath(`${path}\\${fileName}`);
        })
        .catch(err => {
          console.error('Failed to get desktop path:', err);
        });
    }
  }, [desktopPath, modpackName, format]);

  const getFileExtension = (fmt: 'curseforge' | 'modrinth' | 'zip'): string => {
    if (fmt === 'modrinth') return 'mrpack';
    if (fmt === 'curseforge') return 'zip';
    return 'zip';
  };

  const getDefaultFileName = (fmt: 'curseforge' | 'modrinth' | 'zip' = format) =>
    `${modpackName || 'modpack'}.${getFileExtension(fmt)}`;

  const validateOutputPath = (value: string): string | null => {
    if (!value.trim()) {
      return t('modpacks.output_path_required') || 'Путь для сохранения обязателен';
    }
    if (value.trim().length < 3) {
      return t('validation.path_too_short') || 'Путь слишком короткий';
    }
    return null;
  };

  const handleExport = async () => {
    const pathValidation = validateOutputPath(outputPath);
    if (pathValidation) {
      setOutputPathError(pathValidation);
      return;
    }

    setExporting(true);
    setError(null);
    setOutputPathError(null);

    try {
      await modpacksIPC.export(modpackId, format, outputPath, minecraftPath);
      toast.success(t('modpacks.export_success') || 'Модпак успешно экспортирован!');
      onBack();
    } catch (err) {
      console.error('Error exporting modpack:', err);
      const errorMessage = t('modpacks.export_error') || 'Ошибка при экспорте модпака';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setExporting(false);
    }
  };

  const handleSelectPath = async () => {
    try {
      const result = await dialogIPC.showSaveDialog({
        title: t('modpacks.select_export_path') || 'Выберите путь для сохранения',
        defaultPath: desktopPath ? `${desktopPath}\\${getDefaultFileName()}` : getDefaultFileName(),
        filters: [
          {
            name: format === 'zip' ? 'ZIP Archive' : format === 'modrinth' ? 'Modrinth Pack' : 'CurseForge Pack',
            extensions: [getFileExtension(format)],
          },
          { name: 'All Files', extensions: ['*'] },
        ],
      });

      if (result && !result.canceled && result.filePath) {
        setOutputPath(result.filePath);
      }
    } catch (err) {
      console.error('Error selecting path:', err);
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
          disabled={exporting}
        >
          <span>←</span>
          {t('general.back') || 'Назад'}
        </Button>
        <h2 className="text-xl font-bold text-zinc-900 dark:text-white flex-1">
          {t('modpacks.export_title') || 'Экспорт модпака'}
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto p-6 min-h-0">
        <div className="space-y-4 max-w-2xl mx-auto">
          <div>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
              {t('modpacks.export_desc')?.replace('{{name}}', modpackName) || `Экспортировать модпак "${modpackName}" в выбранном формате.`}
            </p>
          </div>

          <Select
            label={t('modpacks.export_format') || 'Формат экспорта'}
            value={format}
            onChange={(e) => {
              const newFormat = e.target.value as 'curseforge' | 'modrinth' | 'zip';
              setFormat(newFormat);
              if (desktopPath) {
                setOutputPath(`${desktopPath}\\${getDefaultFileName(newFormat)}`);
              } else {
                setOutputPath(getDefaultFileName(newFormat));
              }
            }}
          >
            <option value="zip">ZIP Archive</option>
            <option value="curseforge">CurseForge Format</option>
            <option value="modrinth">Modrinth Format</option>
          </Select>

          <div>
            <Input
              label={t('modpacks.output_path') || 'Путь для сохранения'}
              value={outputPath}
              onChange={(e) => {
                const value = e.target.value;
                setOutputPath(value);
                setOutputPathError(validateOutputPath(value));
                setError(null);
              }}
              onBlur={(e) => {
                setOutputPathError(validateOutputPath(e.target.value));
              }}
              placeholder={t('modpacks.output_path_placeholder') || 'Выберите путь...'}
              error={outputPathError || undefined}
              required
              containerClassName="mb-0"
            />
            <div className="flex gap-2 mt-2">
              <Button
                variant="secondary"
                onClick={handleSelectPath}
                size="sm"
                className="flex-1"
              >
                {t('settings.browse')}
              </Button>
            </div>
          </div>

          {error && !outputPathError && (
            <ErrorMessage message={error} />
          )}

          <div className="flex gap-2 pt-4 border-t border-zinc-200 dark:border-zinc-700">
            <Button
              variant="primary"
              onClick={handleExport}
              disabled={exporting || !outputPath.trim() || !!outputPathError}
              className="flex-1"
              style={getAccentStyles('bg').style}
              isLoading={exporting}
            >
              {exporting ? t('modpacks.exporting') || 'Экспорт...' : t('modpacks.export')}
            </Button>
            <Button variant="secondary" onClick={onBack} disabled={exporting}>
              {t('general.cancel')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
