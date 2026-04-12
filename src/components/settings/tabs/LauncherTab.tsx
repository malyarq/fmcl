import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
import { useToast } from '../../../contexts/ToastContext';
import { useConfirm } from '../../../contexts/ConfirmContext';
import { cacheIPC } from '../../../services/ipc/cacheIPC';
import { MinecraftPathSection } from './game/MinecraftPathSection';
import type { UpdateInfo, UpdateStatus } from '../../../features/updater/hooks/useAppUpdater';
import { formatSize } from '../../../utils/format';
import type { ImageCacheState } from '@shared/contracts/cache';

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
  const [imageCacheState, setImageCacheState] = useState<ImageCacheState | null>(null);
  const [imageCacheLimitMb, setImageCacheLimitMb] = useState('256');
  const [isImageCacheBusy, setIsImageCacheBusy] = useState(false);

  const imageCacheUsagePercent = useMemo(() => {
    if (!imageCacheState) {
      return 0;
    }

    return Math.min(100, Math.round(imageCacheState.usageRatio * 100));
  }, [imageCacheState]);

  const loadImageCacheState = useCallback(async () => {
    if (!cacheIPC.has('getImageCacheState')) {
      return;
    }

    const state = await cacheIPC.getImageCacheState();
    setImageCacheState(state);
    setImageCacheLimitMb(String(Math.round(state.maxSizeBytes / (1024 * 1024))));
  }, []);

  useEffect(() => {
    void loadImageCacheState().catch((error) => {
      console.error('Failed to load image cache state:', error);
    });
  }, [loadImageCacheState]);

  const handleSaveImageCacheLimit = useCallback(async () => {
    const parsed = Number(imageCacheLimitMb);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      toast.error(t('settings.image_cache_limit_invalid') || 'Enter a valid image cache limit.');
      return;
    }

    setIsImageCacheBusy(true);
    try {
      const nextState = await cacheIPC.setImageCacheLimit(parsed * 1024 * 1024);
      setImageCacheState(nextState);
      setImageCacheLimitMb(String(Math.round(nextState.maxSizeBytes / (1024 * 1024))));
      toast.success(t('settings.image_cache_limit_saved') || 'Image cache limit updated.');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast.error(`${t('settings.image_cache_limit_error') || 'Failed to update image cache limit.'} ${errorMessage}`);
    } finally {
      setIsImageCacheBusy(false);
    }
  }, [imageCacheLimitMb, t, toast]);

  const handleCleanupImageCache = useCallback(async () => {
    setIsImageCacheBusy(true);
    try {
      const result = await cacheIPC.cleanupImageCache();
      setImageCacheState(result);
      toast.success(
        `${t('settings.image_cache_cleanup_done') || 'Image cache cleaned.'} ${formatSize(result.freedBytes)}`
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast.error(`${t('settings.image_cache_cleanup_error') || 'Failed to clean image cache.'} ${errorMessage}`);
    } finally {
      setIsImageCacheBusy(false);
    }
  }, [t, toast]);

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


      <MinecraftPathSection minecraftPath={minecraftPath} setMinecraftPath={setMinecraftPath} t={t} />

      {imageCacheState && (
        <div className="p-3 bg-zinc-50 dark:bg-zinc-900/40 rounded-lg border border-zinc-100 dark:border-zinc-800 space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-200">
                {t('settings.image_cache_title') || 'Image cache'}
              </p>
              <p className="text-xs text-zinc-500">
                {t('settings.image_cache_desc') || 'Persistent cache for modpack and mod icons.'}
              </p>
            </div>
            <div className="text-right text-xs text-zinc-500">
              <div>{formatSize(imageCacheState.totalSizeBytes)} / {formatSize(imageCacheState.maxSizeBytes)}</div>
              <div>{imageCacheState.entryCount} {t('settings.image_cache_entries') || 'entries'}</div>
            </div>
          </div>

          <div className="space-y-1">
            <div className="h-2 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-zinc-800 dark:bg-zinc-200 transition-all"
                style={{ width: `${imageCacheUsagePercent}%` }}
              />
            </div>
            <p className="text-xs text-zinc-500">
              {imageCacheUsagePercent}% {t('settings.image_cache_used') || 'used'}
            </p>
          </div>

          <div className="flex flex-col md:flex-row gap-3 md:items-end">
            <Input
              type="number"
              min={32}
              step={32}
              value={imageCacheLimitMb}
              onChange={(event) => setImageCacheLimitMb(event.target.value)}
              label={t('settings.image_cache_limit') || 'Image cache limit (MB)'}
              containerClassName="md:max-w-xs"
            />
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={handleSaveImageCacheLimit}
                isLoading={isImageCacheBusy}
              >
                {t('settings.image_cache_save') || 'Save limit'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={handleCleanupImageCache}
                isLoading={isImageCacheBusy}
              >
                {t('settings.image_cache_cleanup') || 'Clean image cache'}
              </Button>
            </div>
          </div>
        </div>
      )}

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
