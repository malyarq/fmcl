import React, { useEffect, useRef, useState } from 'react';
import { useSettings } from '../../contexts/SettingsContext';
import { useToast } from '../../contexts/ToastContext';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import { Modal } from '../ui/Modal';
import { dialogIPC } from '../../services/ipc/dialogIPC';
import { ArchiveExportOperationStatus } from './ArchiveExportOperationStatus';
import { isArchiveExportSuccessful, useArchiveExportOperation } from './useArchiveExportOperation';

interface ExportModpackModalProps {
  modpackId: string;
  modpackName: string;
  isOpen: boolean;
  onClose: () => void;
  onExported?: () => void;
}

export const ExportModpackModal: React.FC<ExportModpackModalProps> = ({ modpackId, modpackName, isOpen, onClose, onExported }) => {
  const { t, getAccentStyles } = useSettings();
  const toast = useToast();
  const [format, setFormat] = useState<'zip' | 'multimc'>('zip');
  const [dialogError, setDialogError] = useState<unknown>(null);
  const completedRef = useRef<string | null>(null);
  const { operation, error, isActive, start } = useArchiveExportOperation(isOpen);

  useEffect(() => {
    if (!operation || !isArchiveExportSuccessful(operation) || completedRef.current === operation.id) return;
    completedRef.current = operation.id;
    toast.success(t('modpacks.export_success') || 'Модпак успешно экспортирован!');
    onExported?.();
    onClose();
  }, [onClose, onExported, operation, t, toast]);

  const handleExport = async () => {
    setDialogError(null);
    try {
      const result = await dialogIPC.showSaveDialog({
        title: t('modpacks.select_export_path') || 'Выберите путь для сохранения',
        defaultPath: `${modpackName || 'modpack'}.zip`,
        filters: [
          { name: format === 'multimc' ? 'MultiMC Archive' : 'ZIP Archive', extensions: ['zip'] },
          { name: 'All Files', extensions: ['*'] },
        ],
      });
      if (result.canceled || !result.filePath) return;
      await start({ kind: 'export', instanceId: modpackId, format, outputPath: result.filePath });
    } catch (nextError) {
      console.error('Error selecting export path:', nextError);
      setDialogError(nextError);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('modpacks.export_title') || 'Экспорт модпака'}>
      <div className="space-y-4">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{t('modpacks.export_desc')?.replace('{{name}}', modpackName) || `Экспортировать модпак "${modpackName}" в выбранном формате.`}</p>
        <Select label={t('modpacks.export_format') || 'Формат экспорта'} value={format} disabled={isActive} onChange={(event) => setFormat(event.target.value as 'zip' | 'multimc')}>
          <option value="zip">ZIP Archive</option>
          <option value="multimc">MultiMC Archive</option>
        </Select>
        <ArchiveExportOperationStatus operation={operation} error={error ?? dialogError} t={t} />
        <div className="flex gap-2 pt-4 border-t border-zinc-200 dark:border-zinc-700">
          <Button variant="primary" onClick={() => void handleExport()} disabled={isActive} className="flex-1" style={getAccentStyles('bg').style} isLoading={isActive}>
            {isActive ? t('modpacks.exporting') || 'Экспорт...' : t('modpacks.export')}
          </Button>
          <Button variant="secondary" onClick={onClose} disabled={isActive}>{t('general.cancel')}</Button>
        </div>
      </div>
    </Modal>
  );
};
