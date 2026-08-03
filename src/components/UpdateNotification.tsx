import React from 'react';
import { UpdateStatus, UpdateInfo } from '../features/updater/hooks/useAppUpdater';
import { useSettings } from '../contexts/SettingsContext';
import { Button } from './ui/Button';
import { cn } from '../utils/cn';

interface UpdateNotificationProps {
  status: UpdateStatus;
  updateInfo: UpdateInfo | null;
  onInstall: () => void;
  onDownload: () => void;
}

// Notification banner that appears at the top when update is available
export const UpdateNotification: React.FC<UpdateNotificationProps> = ({
  status,
  updateInfo,
  onInstall,
  onDownload,
}) => {
  const { t } = useSettings();
  const isDownloaded = status === 'downloaded';
  const bannerTitle = isDownloaded ? t('updater.downloaded') : t('updater.available');
  const bannerDescription = isDownloaded ? t('updater.downloaded_desc') : t('updater.available_desc');

  // Show notification only when update is available or downloaded
  if (status !== 'available' && !isDownloaded) {
    return null;
  }

  return (
    <div
      data-testid="app-update-notification"
      data-update-scope="app-shell"
      className={cn(
        "relative z-[90] w-full shrink-0 px-4 py-2.5 shadow-md animate-in slide-in-from-top duration-300",
        "border-b",
        isDownloaded
          ? "bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100"
          : "bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-100"
      )}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="flex-shrink-0 text-base">
            {isDownloaded ? '✓' : '⬇'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm">
              {bannerTitle}
            </p>
            {updateInfo && (
              <p className="text-xs text-zinc-600 dark:text-zinc-400 truncate">
                {isDownloaded ? bannerDescription : `${bannerDescription} ${updateInfo.version}`}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {isDownloaded ? (
            <Button
              onClick={onInstall}
              variant="secondary"
              className="text-sm px-3 py-1.5 bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-zinc-900 dark:text-zinc-100"
            >
              {t('updater.install')}
            </Button>
          ) : (
            <Button onClick={onDownload} variant="secondary" className="px-3 py-1.5 text-sm">
              {t('updater.download')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
