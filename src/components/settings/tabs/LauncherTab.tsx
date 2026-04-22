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

function translateWithFallback(t: (key: string) => string, key: string, fallback: string) {
  const translated = t(key);
  return translated === key ? fallback : translated;
}

function ToggleRow(props: {
  label: string;
  description: string;
  checked: boolean;
  onToggle: () => void;
}) {
  const { label, description, checked, onToggle } = props;

  return (
    <div className="settings-toggle-row">
      <div className="settings-toggle-copy">
        <p className="settings-toggle-title">{label}</p>
        <p className="settings-toggle-description">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        data-state={checked ? 'checked' : 'unchecked'}
        onClick={onToggle}
        className="settings-toggle-switch"
      >
        <span className="settings-toggle-thumb" data-state={checked ? 'checked' : 'unchecked'} />
      </button>
    </div>
  );
}

export interface LauncherTabProps {
  hideLauncher: boolean;
  setHideLauncher: (val: boolean) => void;
  showConsole: boolean;
  setShowConsole: (val: boolean) => void;
  minecraftPath: string;
  setMinecraftPath: (val: string) => void;
  t: (key: string) => string;
  uiScale: number;
  setUiScale: (val: number) => void;
  disableAnimations: boolean;
  setDisableAnimations: (val: boolean) => void;
  sidebarPosition: 'left' | 'right';
  setSidebarPosition: (val: 'left' | 'right') => void;
  compactMode: boolean;
  setCompactMode: (val: boolean) => void;

  status: UpdateStatus;
  updateInfo: UpdateInfo | null;
  onCheckForUpdates: () => Promise<void>;
  onBeforeCheckForUpdates: () => void;
  embedded?: boolean;
}

export const LauncherTab: React.FC<LauncherTabProps> = ({
  hideLauncher,
  setHideLauncher,
  showConsole,
  setShowConsole,
  minecraftPath,
  setMinecraftPath,
  t,
  uiScale,
  setUiScale,
  disableAnimations,
  setDisableAnimations,
  sidebarPosition,
  setSidebarPosition,
  compactMode,
  setCompactMode,
  status,
  updateInfo,
  onCheckForUpdates,
  onBeforeCheckForUpdates,
  embedded = false,
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

  const accentRangeStyles = useMemo(() => ({ accentColor: 'rgb(var(--accent-main))' }), []);

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]">
      <div className="min-w-0 space-y-4">
        {!embedded && (
          <div className="settings-section-shell settings-section-copy p-5">
            <div className="kicker-label">{t('settings.tab_launcher')}</div>
            <h3 className="text-lg font-bold text-foreground">{t('settings.tab_launcher')}</h3>
            <p className="settings-embedded-copy">{t('settings.launcherHint')}</p>
          </div>
        )}

        <div className="settings-section-shell settings-section-stack min-w-0 p-5">
          <div className="settings-section-copy">
            <h4 className="settings-embedded-title">
              {translateWithFallback(t, 'settings.launcher_runtime_title', 'Launcher Runtime')}
            </h4>
            <p className="settings-embedded-copy">
              {translateWithFallback(
                t,
                'settings.launcher_runtime_desc',
                'Tune how the launcher behaves while you play, debug issues, and navigate the shell.',
              )}
            </p>
          </div>

          <div data-testid="launcher-runtime-grid" className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            <ToggleRow
              label={t('settings.performance')}
              description={t('settings.performance_desc')}
              checked={hideLauncher}
              onToggle={() => setHideLauncher(!hideLauncher)}
            />
            <ToggleRow
              label={t('settings.console')}
              description={t('settings.console_desc')}
              checked={showConsole}
              onToggle={() => setShowConsole(!showConsole)}
            />
            <ToggleRow
              label={translateWithFallback(t, 'settings.animations', 'Enable Animations')}
              description={translateWithFallback(
                t,
                'settings.animations_scope_desc',
                'Controls launcher motion and background effects without changing preset colors or surfaces.',
              )}
              checked={!disableAnimations}
              onToggle={() => setDisableAnimations(!disableAnimations)}
            />
            <ToggleRow
              label={translateWithFallback(t, 'settings.compact_mode', 'Compact Mode')}
              description={translateWithFallback(
                t,
                'settings.compact_mode_desc',
                'Tightens launcher spacing and list density; it does not change the active preset.',
              )}
              checked={compactMode}
              onToggle={() => setCompactMode(!compactMode)}
            />
            <div className="settings-control-card space-y-3">
              <label className="flex justify-between text-sm font-medium text-foreground">
                <span>{translateWithFallback(t, 'settings.ui_zoom', 'Interface Zoom')}</span>
                <span>{uiScale}%</span>
              </label>
              <input
                type="range"
                min="70"
                max="150"
                step="5"
                value={uiScale}
                onChange={(event) => setUiScale(parseInt(event.target.value, 10))}
                className="settings-slider"
                style={accentRangeStyles}
              />
              <div className="flex justify-end">
                <Button size="sm" variant="secondary" onClick={() => setUiScale(100)} disabled={uiScale === 100}>
                  {translateWithFallback(t, 'settings.reset', 'Reset')}
                </Button>
              </div>
            </div>

            <div className="settings-control-card space-y-3">
              <p className="settings-toggle-title">{translateWithFallback(t, 'settings.sidebar_position', 'Sidebar Position')}</p>
              <div className="settings-segmented-row">
                {(['left', 'right'] as const).map((position) => (
                  <button
                    key={position}
                    type="button"
                    onClick={() => setSidebarPosition(position)}
                    aria-pressed={sidebarPosition === position}
                    data-state={sidebarPosition === position ? 'active' : 'inactive'}
                    className="settings-segmented-option"
                  >
                    {position === 'left'
                      ? translateWithFallback(t, 'settings.sidebar_position_left', 'Left')
                      : translateWithFallback(t, 'settings.sidebar_position_right', 'Right')}
                  </button>
                ))}
              </div>
              <p className="settings-embedded-copy">
                {translateWithFallback(
                  t,
                  'settings.sidebar_position_desc',
                  'Moves launcher navigation only; preset visuals stay unchanged.',
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="settings-section-shell min-w-0 p-4">
          <MinecraftPathSection minecraftPath={minecraftPath} setMinecraftPath={setMinecraftPath} t={t} />
        </div>

        <div className="settings-section-shell min-w-0 flex flex-col gap-4 p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <p className="settings-embedded-title">{t('settings.updatesTitle')}</p>
              <p className="settings-embedded-copy">{t('settings.updatesDesc')}</p>
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
            geometry="utility"
            className="w-full"
          >
            {status === 'checking' ? t('updater.checking') : t('updater.check')}
          </Button>
        </div>
      </div>

      <div className="min-w-0 space-y-4">
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
                  geometry="utility"
                  onClick={handleSaveImageCacheLimit}
                  isLoading={isImageCacheBusy}
                  className="w-full sm:flex-1"
                >
                  {t('settings.image_cache_save')}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  geometry="utility"
                  onClick={handleCleanupImageCache}
                  isLoading={isImageCacheBusy}
                  className="w-full sm:flex-1"
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
            geometry="utility"
            className="w-full"
          >
            {t('settings.clear_cache')}
          </Button>
        </div>
      </div>
    </div>
  );
};
