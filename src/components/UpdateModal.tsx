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
}

// Modal dialog for update notifications and progress
export const UpdateModal: React.FC<UpdateModalProps> = ({
  isOpen,
  onClose,
  updateInfo,
  progress,
  status,
  onInstall,
}) => {
  const { t, getAccentStyles } = useSettings();

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('updater.available')}>
      <div className="space-y-4">
        {/* Current and Latest Version Info */}
        <div className="grid grid-cols-2 gap-4 p-4 bg-zinc-50 dark:bg-zinc-900/40 rounded-lg border border-zinc-200 dark:border-zinc-700">
          <div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">
              {t('updater.current_version')}
            </p>
            <p className="font-mono font-bold text-sm text-zinc-900 dark:text-white">
              v{pkg.version}
            </p>
          </div>
          <div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">
              {t('updater.latest_version')}
            </p>
            <p className="font-mono font-bold text-sm text-zinc-900 dark:text-white">
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
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {t('updater.available_desc')} {updateInfo?.version}
          </p>
        )}

        {status === 'downloading' && (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {t('updater.downloading')}
          </p>
        )}

        {status === 'downloaded' && (
          <div className="p-3 bg-zinc-50 dark:bg-zinc-900/40 rounded-lg border border-zinc-200 dark:border-zinc-700">
            <p className="text-sm text-zinc-700 dark:text-zinc-300">
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
                className="flex-1 bg-zinc-200 text-zinc-900 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-600"
              >
                {t('updater.later')}
              </Button>
              <Button
                onClick={onInstall}
                className={cn("flex-1 text-white", getAccentStyles('bg').className)}
                style={getAccentStyles('bg').style}
              >
                {t('updater.install')}
              </Button>
            </>
          ) : status === 'downloading' ? (
            <Button
              onClick={onClose}
              variant="secondary"
              className="flex-1 bg-zinc-200 text-zinc-900 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-600"
            >
              {t('updater.later')}
            </Button>
          ) : (
            <Button
              onClick={onClose}
              variant="secondary"
              className="flex-1 bg-zinc-200 text-zinc-900 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-600"
            >
              {t('updater.later')}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
};
