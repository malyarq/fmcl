import React, { useState } from 'react';
import { useSettings } from '../../contexts/SettingsContext';
import { useToast } from '../../contexts/ToastContext';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Modal } from '../ui/Modal';
import { ErrorMessage } from '../ui/ErrorMessage';
import { modpacksIPC } from '../../services/ipc/modpacksIPC';
import { dialogIPC } from '../../services/ipc/dialogIPC';

interface ExportModpackModalProps {
  modpackId: string;
  modpackName: string;
  isOpen: boolean;
  onClose: () => void;
  onExported?: () => void;
}

export const ExportModpackModal: React.FC<ExportModpackModalProps> = ({
  modpackId,
  modpackName,
  isOpen,
  onClose,
  onExported,
}) => {
  const { t, getAccentStyles, minecraftPath } = useSettings();
  const toast = useToast();
  const [format, setFormat] = useState<'curseforge' | 'modrinth' | 'zip'>('zip');
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outputPath, setOutputPath] = useState('');
  const [outputPathError, setOutputPathError] = useState<string | null>(null);

  const validateOutputPath = (value: string): string | null => {
    if (!value.trim()) {
      return t('modpacks.output_path_required') || 'Путь для сохранения обязателен';
    }
    // Basic path validation
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
      onExported?.();
      onClose();
      setOutputPath('');
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
      // Use Electron dialog to select save path
      const result = await dialogIPC.showSaveDialog({
        title: t('modpacks.select_export_path') || 'Выберите путь для сохранения',
        defaultPath: `${modpackName}.${format === 'zip' ? 'zip' : format === 'modrinth' ? 'mrpack' : 'zip'}`,
        filters: [
          {
            name: format === 'zip' ? 'ZIP Archive' : format === 'modrinth' ? 'Modrinth Pack' : 'CurseForge Pack',
            extensions: format === 'zip' ? ['zip'] : format === 'modrinth' ? ['mrpack'] : ['zip'],
          },
          { name: 'All Files', extensions: ['*'] },
        ],
      });

      if (result && !result.canceled && result.filePath) {
        setOutputPath(result.filePath);
      }
    } catch (err) {
      console.error('Error selecting path:', err);
      // Fallback: allow manual input
    }
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('modpacks.export_title') || 'Экспорт модпака'}>
      <div className="space-y-4">
        <div>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
            {t('modpacks.export_desc')?.replace('{{name}}', modpackName) || `Экспортировать модпак "${modpackName}" в выбранном формате.`}
          </p>
        </div>

        <Select
          label={t('modpacks.export_format') || 'Формат экспорта'}
          value={format}
          onChange={(e) => {
            setFormat(e.target.value as 'curseforge' | 'modrinth' | 'zip');
            setOutputPath('');
          }}
        >
          <option value="zip">ZIP Archive</option>
          <option value="curseforge">CurseForge Format</option>
          <option value="modrinth">Modrinth Format (.mrpack)</option>
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
          <Button variant="secondary" onClick={onClose}>
            {t('general.cancel')}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
