import React from 'react';
import { Button } from '../../ui/Button';
import { useToast } from '../../../contexts/ToastContext';
import { useConfirm } from '../../../contexts/ConfirmContext';
import { cacheIPC } from '../../../services/ipc/cacheIPC';
import { MinecraftPathSection } from './game/MinecraftPathSection';
import type { UpdateInfo, UpdateStatus } from '../../../features/updater/hooks/useAppUpdater';

export interface LauncherTabProps {
  hideLauncher: boolean;
  setHideLauncher: (val: boolean) => void;
  showConsole: boolean;
  setShowConsole: (val: boolean) => void;
  minecraftPath: string;
  setMinecraftPath: (val: string) => void;
  t: (key: string) => string;

  status: UpdateStatus;
  updateInfo: UpdateInfo | null;
  onCheckForUpdates: () => Promise<void>;
  onBeforeCheckForUpdates: () => void;
}

export const LauncherTab: React.FC<LauncherTabProps> = ({
  hideLauncher,
  setHideLauncher,
  showConsole,
  setShowConsole,
  minecraftPath,
  setMinecraftPath,
  t,
  status,
  updateInfo,
  onCheckForUpdates,
  onBeforeCheckForUpdates,
}) => {
  const toast = useToast();
  const confirm = useConfirm();
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-900/40 rounded-lg border border-zinc-100 dark:border-zinc-800">
        <div>
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-200">{t('settings.performance')}</p>
          <p className="text-xs text-zinc-500">{t('settings.performance_desc')}</p>
        </div>
        <input
          type="checkbox"
          checked={hideLauncher}
          onChange={(e) => setHideLauncher(e.target.checked)}
          className="w-4 h-4 rounded cursor-pointer accent-current text-zinc-800 dark:text-white"
        />
      </div>

      <div className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-900/40 rounded-lg border border-zinc-100 dark:border-zinc-800">
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-200">{t('settings.console')}</p>
        <input
          type="checkbox"
          checked={showConsole}
          onChange={(e) => setShowConsole(e.target.checked)}
          className="w-4 h-4 rounded cursor-pointer accent-current text-zinc-800 dark:text-white"
        />
      </div>

      <div className="flex gap-3 items-stretch">
        <div className="flex-1 p-3 bg-zinc-50 dark:bg-zinc-900/40 rounded-lg border border-zinc-100 dark:border-zinc-800 flex flex-col">
          <div className="mt-auto">
            <Button
              onClick={async () => {
                onBeforeCheckForUpdates();
                await onCheckForUpdates();
              }}
              disabled={status === 'checking' || status === 'downloading'}
              variant="secondary"
              className="w-full bg-zinc-200 text-zinc-900 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-600"
            >
              {status === 'checking' ? t('updater.checking') : t('updater.check')}
            </Button>
          </div>
        </div>

        <div className="flex-1 p-3 bg-zinc-50 dark:bg-zinc-900/40 rounded-lg border border-zinc-100 dark:border-zinc-800 flex flex-col">
          <div className="mt-auto">
            <Button
              onClick={async () => {
                const confirmed = await confirm.confirm({
                  title: t('settings.clear_cache') || 'Очистить кэш',
                  message: t('settings.clear_cache_confirm') || 'Вы уверены, что хотите очистить весь кэш и перезагрузить лаунчер?',
                  variant: 'default',
                  confirmText: t('settings.clear_cache') || 'Очистить',
                  cancelText: t('general.cancel') || 'Отмена',
                });
                if (!confirmed) return;
                try {
                  const result = await cacheIPC.clear();
                  if (result.success) {
                    await cacheIPC.reload();
                    toast.success(t('settings.clear_cache') + ' ' + (t('general.done') || 'выполнено'));
                  } else {
                    toast.error(t('error.failed_clear_cache') + ': ' + (result.error || 'Unknown error'));
                  }
                } catch (error) {
                  const errorMessage = error instanceof Error ? error.message : String(error);
                  toast.error(t('error.clearing_cache') + ': ' + errorMessage);
                }
              }}
              variant="secondary"
              className="w-full bg-zinc-200 text-zinc-900 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-600"
            >
              {t('settings.clear_cache')}
            </Button>
          </div>
        </div>
      </div>

      <MinecraftPathSection minecraftPath={minecraftPath} setMinecraftPath={setMinecraftPath} t={t} />

      {(status === 'checking' || status === 'available' || status === 'up-to-date' || status === 'error') && (
        <div className="flex items-center justify-between">
          {status === 'checking' && <span className="text-xs text-zinc-500">{t('updater.checking')}</span>}
          {status === 'available' && updateInfo && (
            <span className="text-xs text-zinc-600 dark:text-zinc-400">
              {t('updater.available')}: {updateInfo.version}
            </span>
          )}
          {status === 'up-to-date' && <span className="text-xs text-zinc-500">{t('updater.up_to_date')}</span>}
          {status === 'error' && <span className="text-xs text-red-600 dark:text-red-400">{t('updater.error')}</span>}
        </div>
      )}
    </div>
  );
};

