import React from 'react';
import { Button } from '../../ui/Button';
import { cn } from '../../../utils/cn';

export interface ModpackDetailsActionsProps {
  onLaunch: () => void;
  hasUpdate: boolean;
  onShowUpdate: () => void;
  onRename: () => void;
  onDuplicate: () => void;
  onExport: () => void;
  canDelete: boolean;
  onDelete: () => void;
  t: (key: string) => string;
  getAccentStyles: (type: 'bg' | 'text' | 'border' | 'ring' | 'hover' | 'accent' | 'title' | 'soft-bg' | 'soft-border') => {
    className?: string;
    style?: React.CSSProperties;
  };
}

export const ModpackDetailsActions: React.FC<ModpackDetailsActionsProps> = ({
  onLaunch,
  hasUpdate,
  onShowUpdate,
  onRename,
  onDuplicate,
  onExport,
  canDelete,
  onDelete,
  t,
  getAccentStyles,
}) => (
  <div className="surface-inline mx-6 mb-6 flex flex-shrink-0 flex-wrap gap-2 px-4 py-4">
    <Button variant="primary" onClick={onLaunch} className="flex-1" style={getAccentStyles('bg').style}>
      {t('general.play')}
    </Button>
    {hasUpdate && (
      <Button
        variant="primary"
        onClick={onShowUpdate}
        className={cn(getAccentStyles('bg').className)}
        style={getAccentStyles('bg').style}
      >
        {t('modpacks.update_available') || 'Обновление доступно'}
      </Button>
    )}
    <Button variant="secondary" onClick={onRename}>
      {t('modpacks.rename')}
    </Button>
    <Button variant="secondary" onClick={onDuplicate}>
      {t('modpacks.duplicate')}
    </Button>
    <Button variant="secondary" onClick={onExport}>
      {t('modpacks.export') || 'Экспорт'}
    </Button>
    {canDelete && (
      <Button variant="danger" onClick={onDelete}>
        {t('modpacks.delete')}
      </Button>
    )}
  </div>
);
