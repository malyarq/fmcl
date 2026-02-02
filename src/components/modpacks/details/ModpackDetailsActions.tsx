import React from 'react';
import { Button } from '../../ui/Button';
import { cn } from '../../../utils/cn';

export interface ModpackDetailsActionsProps {
  onLaunch: () => void;
  hasUpdate: boolean;
  onShowUpdate: () => void;
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
  onDuplicate,
  onExport,
  canDelete,
  onDelete,
  t,
  getAccentStyles,
}) => (
  <div className="flex-shrink-0 flex gap-2 px-6 pt-4 pb-4 border-t border-zinc-200 dark:border-zinc-700 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-sm">
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
