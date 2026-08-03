import React, { useEffect, useRef, useState } from 'react';
import { useSettings } from '../../contexts/SettingsContext';
import { useToast } from '../../contexts/ToastContext';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import { Breadcrumbs } from '../ui/Breadcrumbs';
import { modpacksIPC } from '../../services/ipc/modpacksIPC';
import { dialogIPC } from '../../services/ipc/dialogIPC';
import { ArrowLeft } from 'lucide-react';
import { ArchiveExportOperationStatus } from './ArchiveExportOperationStatus';
import { isArchiveExportSuccessful, useArchiveExportOperation } from './useArchiveExportOperation';

interface ExportModpackPageProps {
  modpackId: string;
  onBack: () => void;
}

type ExportFormat = 'zip' | 'multimc';

export const ExportModpackPage: React.FC<ExportModpackPageProps> = ({ modpackId, onBack }) => {
  const { t, getAccentStyles, minecraftPath } = useSettings();
  const toast = useToast();
  const [modpackName, setModpackName] = useState('');
  const [format, setFormat] = useState<ExportFormat>('multimc');
  const [dialogError, setDialogError] = useState<unknown>(null);
  const completedRef = useRef<string | null>(null);
  const { operation, error, isActive, start } = useArchiveExportOperation();

  useEffect(() => {
    void modpacksIPC.getMetadata(modpackId, minecraftPath)
      .then((metadata) => setModpackName(metadata.name || ''))
      .catch((nextError) => console.error('Error loading modpack name:', nextError));
  }, [modpackId, minecraftPath]);

  useEffect(() => {
    if (!operation || !isArchiveExportSuccessful(operation) || completedRef.current === operation.id) return;
    completedRef.current = operation.id;
    toast.success(t('modpacks.export_success') || 'Модпак успешно экспортирован!');
    onBack();
  }, [onBack, operation, t, toast]);

  const getDefaultFileName = () => `${modpackName || 'modpack'}.zip`;

  const handleExport = async () => {
    setDialogError(null);
    try {
      const result = await dialogIPC.showSaveDialog({
        title: t('modpacks.select_export_path') || 'Выберите путь для сохранения',
        defaultPath: getDefaultFileName(),
        filters: [
          { name: format === 'multimc' ? 'MultiMC Archive' : 'ZIP Archive', extensions: ['zip'] },
          { name: 'All Files', extensions: ['*'] },
        ],
      });
      if (result.canceled || !result.filePath) return;

      await start({
        kind: 'export',
        rootPath: minecraftPath,
        instanceId: modpackId,
        format,
        outputPath: result.filePath,
        options: { includeSaves, includeScreenshots, includeResourcePacks, includeShaders, includeMods },
      });
    } catch (nextError) {
      console.error('Error selecting export path:', nextError);
      setDialogError(nextError);
    }
  };

  const [includeSaves, setIncludeSaves] = useState(false);
  const [includeScreenshots, setIncludeScreenshots] = useState(false);
  const [includeResourcePacks, setIncludeResourcePacks] = useState(false);
  const [includeShaders, setIncludeShaders] = useState(false);
  const [includeMods, setIncludeMods] = useState(true);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex flex-col gap-4 border-b border-border/70 bg-card/78 px-6 py-4 backdrop-blur-md">
        <Breadcrumbs items={[
          { label: t('modpacks.title') || 'Modpacks', onClick: onBack },
          { label: t('modpacks.export_title') || 'Экспорт модпака', active: true },
        ]} />
        <div className="flex items-center gap-4">
          <Button variant="secondary" size="sm" onClick={onBack} className="flex items-center gap-2" disabled={isActive}>
            <ArrowLeft className="h-4 w-4" />
            {t('general.back') || 'Назад'}
          </Button>
          <div className="min-w-0 flex-1">
            <div className="kicker-label">{t('modpacks.title') || 'Modpacks'}</div>
            <h2 className="text-xl font-bold text-foreground">{t('modpacks.export_title') || 'Экспорт модпака'}</h2>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 min-h-0">
        <div className="space-y-6 max-w-2xl mx-auto">
          <div className="surface-muted p-4"><p className="text-sm text-secondary">{t('modpacks.export_desc')?.replace('{{name}}', modpackName) || `Экспортировать модпак "${modpackName}" в выбранном формате.`}</p></div>
          <Select label={t('modpacks.export_format') || 'Формат экспорта'} value={format} disabled={isActive} onChange={(event) => setFormat(event.target.value as ExportFormat)}>
            <option value="multimc">{t('modpacks.export_format_multimc') || 'MultiMC / Prism Launcher / FriendLauncher (.zip)'}</option>
            <option value="zip">{t('modpacks.export_format_zip') || 'Raw ZIP Archive (Instance Copy)'}</option>
          </Select>
          <div className="surface-card space-y-3 p-4">
            <h4 className="mb-2 text-sm font-semibold text-foreground">{t('modpacks.export_options') || 'Опции экспорта'}</h4>
            {[
              ['includeSaves', includeSaves, setIncludeSaves, t('modpacks.include_saves') || 'Включить сохранения миров (saves)'],
              ['includeScreenshots', includeScreenshots, setIncludeScreenshots, t('modpacks.include_screenshots') || 'Включить скриншоты'],
              ['includeResourcePacks', includeResourcePacks, setIncludeResourcePacks, t('modpacks.include_resourcepacks') || 'Включить ресурспаки'],
              ['includeShaders', includeShaders, setIncludeShaders, t('modpacks.include_shaders') || 'Включить шейдеры'],
              ['includeMods', includeMods, setIncludeMods, t('modpacks.include_mods') || 'Включить моды (JAR файлы)'],
            ].map(([id, checked, setChecked, label]) => (
              <div className="flex items-center gap-2" key={id as string}>
                <input id={id as string} type="checkbox" checked={checked as boolean} disabled={isActive} onChange={(event) => (setChecked as React.Dispatch<React.SetStateAction<boolean>>)(event.target.checked)} className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500" />
                <label htmlFor={id as string} className="cursor-pointer select-none text-sm text-secondary">{label as string}</label>
              </div>
            ))}
          </div>
          <ArchiveExportOperationStatus operation={operation} error={error ?? dialogError} t={t} />
          <div className="surface-inline flex gap-2 pt-4">
            <Button variant="primary" onClick={() => void handleExport()} disabled={isActive} className="flex-1" style={getAccentStyles('bg').style} isLoading={isActive}>
              {isActive ? t('modpacks.exporting') || 'Экспорт...' : t('modpacks.export')}
            </Button>
            <Button variant="secondary" onClick={onBack} disabled={isActive}>{t('general.cancel')}</Button>
          </div>
        </div>
      </div>
    </div>
  );
};
