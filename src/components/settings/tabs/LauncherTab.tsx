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
      toast.error(t('settings.image_cache_limit_invalid'));
      return;
    }

    setIsImageCacheBusy(true);
    try {
      const nextState = await cacheIPC.setImageCacheLimit(parsed * 1024 * 1024);
      setImageCacheState(nextState);
      setImageCacheLimitMb(String(Math.round(nextState.maxSizeBytes / (1024 * 1024))));
      toast.success(t('settings.image_cache_limit_saved'));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast.error(`${t('settings.image_cache_limit_error')} ${errorMessage}`);
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
        `${t('settings.image_cache_cleanup_done')} ${formatSize(result.freedBytes)}`
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast.error(`${t('settings.image_cache_cleanup_error')} ${errorMessage}`);
    } finally {
      setIsImageCacheBusy(false);
    }
  }, [t, toast]);

  return (
    <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
      <div className="space-y-4">
        <div className="surface-card space-y-4 p-5">
          <div className="space-y-2">
            <div className="kicker-label">{t('settings.tab_launcher')}</div>
            <h3 className="text-lg font-bold text-foreground">{t('settings.tab_launcher')}</h3>
            <p className="text-sm text-secondary">{t('settings.launcherHint')}</p>
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <div className="surface-muted p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-foreground">{t('settings.performance')}</p>
                  <p id="settings-performance-hint" className="text-sm text-secondary">{t('settings.performance_desc')}</p>
                </div>
                <input
                  type="checkbox"
                  checked={hideLauncher}
                  onChange={(e) => setHideLauncher(e.target.checked)}
                  aria-describedby="settings-performance-hint"
                  className="mt-1 h-4 w-4 cursor-pointer rounded border-border/70 bg-card text-[rgb(var(--accent-main))] focus:ring-[rgb(var(--accent-main))] focus:ring-offset-background"
                />
              </div>
            </div>

            <div className="surface-muted p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-foreground">{t('settings.console')}</p>
                  <p id="settings-console-hint" className="text-sm text-secondary">{t('settings.console_desc')}</p>
                </div>
                <input
                  type="checkbox"
                  checked={showConsole}
                  onChange={(e) => setShowConsole(e.target.checked)}
                  aria-describedby="settings-console-hint"
                  className="mt-1 h-4 w-4 cursor-pointer rounded border-border/70 bg-card text-[rgb(var(--accent-main))] focus:ring-[rgb(var(--accent-main))] focus:ring-offset-background"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="surface-card p-4">
          <MinecraftPathSection minecraftPath={minecraftPath} setMinecraftPath={setMinecraftPath} t={t} />
        </div>

        <div className="surface-card flex flex-col gap-4 p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">{t('settings.updatesTitle')}</p>
              <p className="text-sm text-secondary">{t('settings.updatesDesc')}</p>
            </div>
            {(status === 'checking' || status === 'available' || status === 'up-to-date' || status === 'error') && (
              <div className="surface-inline px-3 py-2 text-xs">
                {status === 'checking' && <span className="text-secondary">{t('updater.checking')}</span>}
                {status === 'available' && updateInfo && (
                  <span className="text-secondary">
                    {t('updater.available')}: {updateInfo.version}
                  </span>
                )}
                {status === 'up-to-date' && <span className="text-secondary">{t('updater.up_to_date')}</span>}
                {status === 'error' && <span className="text-red-600 dark:text-red-400">{t('updater.error')}</span>}
              </div>
            )}
          </div>

          <Button
            onClick={async () => {
              onBeforeCheckForUpdates();
              await onCheckForUpdates();
            }}
            disabled={status === 'checking' || status === 'downloading'}
            variant="secondary"
            className="sm:w-fit"
          >
            {status === 'checking' ? t('updater.checking') : t('updater.check')}
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {imageCacheState && (
          <div className="surface-card space-y-4 p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {t('settings.image_cache_title')}
                </p>
                <p className="text-sm text-secondary">
                  {t('settings.image_cache_desc')}
                </p>
              </div>
              <div className="text-right text-xs text-secondary">
                <div>{formatSize(imageCacheState.totalSizeBytes)} / {formatSize(imageCacheState.maxSizeBytes)}</div>
                <div>{imageCacheState.entryCount} {t('settings.image_cache_entries')}</div>
              </div>
            </div>

            <div className="space-y-1">
              <div className="h-2 overflow-hidden rounded-full bg-background/80">
                <div
                  className="h-full rounded-full bg-[rgb(var(--accent-main))] transition-all"
                  style={{ width: `${imageCacheUsagePercent}%` }}
                />
              </div>
              <p className="text-xs text-secondary">
                {imageCacheUsagePercent}% {t('settings.image_cache_used')}
              </p>
            </div>

            <div className="flex flex-col gap-3 md:items-start">
              <Input
                type="number"
                min={32}
                step={32}
                value={imageCacheLimitMb}
                onChange={(event) => setImageCacheLimitMb(event.target.value)}
                label={t('settings.image_cache_limit')}
                containerClassName="w-full"
              />
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleSaveImageCacheLimit}
                  isLoading={isImageCacheBusy}
                >
                  {t('settings.image_cache_save')}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleCleanupImageCache}
                  isLoading={isImageCacheBusy}
                >
                  {t('settings.image_cache_cleanup')}
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="surface-card flex flex-col gap-3 p-5">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">{t('settings.clear_cache')}</p>
            <p className="text-sm text-secondary">{t('settings.clear_cache_desc')}</p>
          </div>
          <Button
            onClick={async () => {
              const confirmed = await confirm.confirm({
                title: t('settings.clear_cache'),
                message: t('settings.clear_cache_confirm'),
                variant: 'default',
                confirmText: t('settings.clear_cache'),
                cancelText: t('general.cancel'),
              });
              if (!confirmed) return;
              try {
                const result = await cacheIPC.clear();
                if (result.success) {
                  await cacheIPC.reload();
                  toast.success(t('settings.clear_cache_success'));
                } else {
                  toast.error(t('error.failed_clear_cache') + ': ' + (result.error || t('error.unexpected_error')));
                }
              } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                toast.error(t('error.clearing_cache') + ': ' + errorMessage);
              }
            }}
            variant="secondary"
            className="sm:w-fit"
          >
            {t('settings.clear_cache')}
          </Button>
        </div>
      </div>
    </div>
  );
};
