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
}) => {
  const primaryAction = hasUpdate ? 'update' : 'play';
  const primaryLabel =
    primaryAction === 'update'
      ? t('modpacks.update_available') || 'Update available'
      : t('general.play');

  return (
    <section className="surface-card flex h-full flex-col gap-4 p-4" data-testid="modpack-details-actions">
      <div className="space-y-3">
        <div className="kicker-label">{primaryLabel}</div>
        <div className="grid gap-2">
          {primaryAction === 'play' ? (
            <Button
              variant="primary"
              onClick={onLaunch}
              className="w-full"
              style={getAccentStyles('bg').style}
              data-primary-action="route"
              data-route-action="play"
            >
              {t('general.play')}
            </Button>
          ) : (
            <>
              <Button
                variant="primary"
                onClick={onShowUpdate}
                className={cn('w-full', getAccentStyles('bg').className)}
                style={getAccentStyles('bg').style}
                data-primary-action="route"
                data-route-action="update"
              >
                {t('modpacks.update_available') || 'Обновление доступно'}
              </Button>
              <Button variant="secondary" onClick={onLaunch} className="w-full" data-route-action="play">
                {t('general.play')}
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="border-t border-border/60 pt-4">
        <div className="kicker-label">{t('modpacks.actions_title')}</div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
          <Button variant="secondary" onClick={onRename} className="w-full">
            {t('modpacks.rename')}
          </Button>
          <Button variant="secondary" onClick={onDuplicate} className="w-full">
            {t('modpacks.duplicate')}
          </Button>
          <Button variant="secondary" onClick={onExport} className="w-full">
            {t('modpacks.export') || 'Экспорт'}
          </Button>
          {canDelete && (
            <Button variant="danger" onClick={onDelete} className="w-full">
              {t('modpacks.delete')}
            </Button>
          )}
        </div>
      </div>
    </section>
  );
};
