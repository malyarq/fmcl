import React from 'react';
import { UpdateInfo, UpdateProgress } from '../features/updater/hooks/useAppUpdater';
import { useSettings } from '../contexts/SettingsContext';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { ProgressBar, formatBytes } from './ui/ProgressBar';
import { cn } from '../utils/cn';
import pkg from '../../package.json';

interface UpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  updateInfo: UpdateInfo | null;
  progress: UpdateProgress | null;
  status: 'available' | 'downloading' | 'downloaded';
  onInstall: () => void;
  onDownload: () => void;
}

// Modal dialog for update notifications and progress
export const UpdateModal: React.FC<UpdateModalProps> = ({
  isOpen,
  onClose,
  updateInfo,
  progress,
  status,
  onInstall,
  onDownload,
}) => {
  const { t, getAccentStyles } = useSettings();

  return (
    <Modal isOpen={isOpen} onClose={onClose} closeLabel={t('general.close_dialog')} title={t('updater.available')}>
      <div className="space-y-4">
        {/* Current and Latest Version Info */}
        <div className="surface-soft grid grid-cols-2 gap-4 p-4">
          <div>
            <p className="helper-text mb-1">
              {t('updater.current_version')}
            </p>
            <p className="text-sm font-mono font-bold text-foreground">
              v{pkg.version}
            </p>
          </div>
          <div>
            <p className="helper-text mb-1">
              {t('updater.latest_version')}
            </p>
            <p className="text-sm font-mono font-bold text-foreground">
              {updateInfo?.version ? `v${updateInfo.version}` : '—'}
            </p>
          </div>
        </div>

        {/* Download Progress */}
        {status === 'downloading' && progress && (
          <ProgressBar
            value={progress.percent}
            label={t('updater.progress')}
            valueLabel={`${Math.round(progress.percent)}% (${formatBytes(progress.transferred)} / ${formatBytes(progress.total)})`}
            animated
          />
        )}

        {/* Status Messages */}
        {status === 'available' && (
          <p className="text-sm text-secondary">
            {t('updater.available_desc')} {updateInfo?.version}
          </p>
        )}

        {status === 'downloading' && (
          <p className="text-sm text-secondary">
            {t('updater.downloading')}
          </p>
        )}

        {status === 'downloaded' && (
          <div className="surface-soft p-3">
            <p className="text-sm text-foreground">
              {t('updater.downloaded_desc')}
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 pt-2">
          {status === 'downloaded' ? (
            <>
              <Button
                onClick={onClose}
                variant="secondary"
                className="flex-1"
              >
                {t('updater.later')}
              </Button>
              <Button
                onClick={onInstall}
                className={cn("flex-1 text-[rgb(var(--accent-content))]", getAccentStyles('bg').className)}
                style={getAccentStyles('bg').style}
              >
                {t('updater.install')}
              </Button>
            </>
          ) : status === 'downloading' ? (
            <Button
              onClick={onClose}
              variant="secondary"
              className="flex-1"
            >
              {t('updater.later')}
            </Button>
          ) : (
            <>
              <Button
                onClick={onClose}
                variant="secondary"
                className="flex-1"
              >
                {t('updater.later')}
              </Button>
              <Button onClick={onDownload} className="flex-1">
                {t('updater.download')}
              </Button>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
};
