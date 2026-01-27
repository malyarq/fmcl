import React, { useState } from 'react';
import { useSettings } from '../../contexts/SettingsContext';
import { Button } from '../ui/Button';
import { cn } from '../../utils/cn';
import { ModpackUpdateModal } from './ModpackUpdateModal';
import type { ModpackUpdateInfo } from '../../features/modpacks/hooks/useModpackUpdates';

interface ModpackUpdateNotificationProps {
  updates: ModpackUpdateInfo[];
  onDismiss?: () => void;
}

export const ModpackUpdateNotification: React.FC<ModpackUpdateNotificationProps> = ({
  updates,
  onDismiss,
}) => {
  const { t } = useSettings();
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [selectedUpdate, setSelectedUpdate] = useState<ModpackUpdateInfo | null>(null);

  if (updates.length === 0) {
    return null;
  }

  const handleUpdate = (update: ModpackUpdateInfo) => {
    setSelectedUpdate(update);
    setShowUpdateModal(true);
  };

  const handleClose = () => {
    setShowUpdateModal(false);
    setSelectedUpdate(null);
    onDismiss?.();
  };

  return (
    <>
      <div
        className={cn(
          "fixed top-0 left-0 right-0 z-50 px-4 py-2.5 shadow-md animate-in slide-in-from-top duration-300",
          "border-b bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-100"
        )}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="flex-shrink-0 text-base">⬇</div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">
                {updates.length === 1
                  ? t('modpacks.update_available_single') || 'Доступно обновление модпака'
                  : t('modpacks.update_available_multiple')?.replace('{{count}}', String(updates.length)) || `Доступно обновлений: ${updates.length}`}
              </p>
              {updates.length === 1 && (
                <p className="text-xs text-zinc-600 dark:text-zinc-400 truncate">
                  {updates[0].modpackName}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              onClick={() => handleUpdate(updates[0])}
              variant="secondary"
              className="text-sm px-3 py-1.5 bg-blue-200 hover:bg-blue-300 dark:bg-blue-800 dark:hover:bg-blue-700 text-blue-900 dark:text-blue-100"
            >
              {t('modpacks.update') || 'Обновить'}
            </Button>
            {onDismiss && (
              <button
                onClick={onDismiss}
                className="text-blue-700 dark:text-blue-300 hover:text-blue-900 dark:hover:text-blue-100 text-sm px-2"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {showUpdateModal && selectedUpdate && (
        <ModpackUpdateModal
          modpackId={selectedUpdate.modpackId}
          sourceId={selectedUpdate.sourceId}
          source={selectedUpdate.source}
          currentVersion={selectedUpdate.currentVersion}
          isOpen={showUpdateModal}
          onClose={handleClose}
          onUpdated={handleClose}
        />
      )}
    </>
  );
};
