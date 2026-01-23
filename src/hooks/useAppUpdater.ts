import { useState, useEffect, useCallback } from 'react';

export interface UpdateInfo {
  version: string;
  releaseDate?: string;
  releaseName?: string;
  releaseNotes?: string;
}

export interface UpdateProgress {
  percent: number;
  transferred: number;
  total: number;
}

export type UpdateStatus = 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'error' | 'up-to-date';

export interface UseAppUpdaterReturn {
  status: UpdateStatus;
  updateInfo: UpdateInfo | null;
  progress: UpdateProgress | null;
  error: string | null;
  checkForUpdates: () => Promise<void>;
  installUpdate: () => void;
}

export function useAppUpdater(autoCheck: boolean = true): UseAppUpdaterReturn {
  const [status, setStatus] = useState<UpdateStatus>('idle');
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [progress, setProgress] = useState<UpdateProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Check if appUpdater API is available
  const isAvailable = typeof window !== 'undefined' && 'appUpdater' in window;

  const checkForUpdates = useCallback(async () => {
    if (!isAvailable) {
      setError('Update system not available');
      return;
    }

    setStatus('checking');
    setError(null);
    setProgress(null);

    try {
      const result = await window.appUpdater.check();
      // In dev mode, electron-updater skips checking (not packed)
      // This is expected behavior and not an error
      if (!result || result.cancelled) {
        setStatus('idle');
      }
    } catch (err) {
      // Ignore dev mode errors
      const errorMsg = err instanceof Error ? err.message : String(err);
      if (errorMsg.includes('not packed') || errorMsg.includes('dev update config')) {
        setStatus('idle');
        setError(null);
      } else {
        setStatus('error');
        setError(errorMsg || 'Failed to check for updates');
      }
    }
  }, [isAvailable]);

  const installUpdate = useCallback(() => {
    if (!isAvailable) return;
    window.appUpdater.quitAndInstall();
  }, [isAvailable]);

  useEffect(() => {
    if (!isAvailable) return;

    const statusUnsub = window.appUpdater.onStatus((newStatus: string) => {
      if (newStatus === 'checking') {
        setStatus('checking');
      }
    });

    const availableUnsub = window.appUpdater.onAvailable((info) => {
      setStatus('available');
      setUpdateInfo({
        version: info.version || info.tag || 'Unknown',
        releaseDate: info.releaseDate,
        releaseName: info.releaseName,
        releaseNotes: info.releaseNotes,
      });
      // Auto-download when update is available
      // The backend already does this, but we track the status
    });

    const notAvailableUnsub = window.appUpdater.onNotAvailable(() => {
      setStatus('up-to-date');
      setUpdateInfo(null);
    });

    const errorUnsub = window.appUpdater.onError((err: string) => {
      setStatus('error');
      setError(err);
    });

    const progressUnsub = window.appUpdater.onProgress((prog) => {
      setStatus('downloading');
      setProgress({
        percent: prog.percent || 0,
        transferred: prog.transferred || 0,
        total: prog.total || 0,
      });
    });

    const downloadedUnsub = window.appUpdater.onDownloaded((info) => {
      setStatus('downloaded');
      setProgress(null);
      setUpdateInfo((prev) => ({
        ...prev!,
        version: info.version || prev?.version || 'Unknown',
      }));
    });

    // Auto-check on mount if enabled
    if (autoCheck) {
      // Delay auto-check slightly to avoid blocking initial render
      const timer = setTimeout(() => {
        checkForUpdates();
      }, 2000);
      return () => {
        clearTimeout(timer);
        statusUnsub();
        availableUnsub();
        notAvailableUnsub();
        errorUnsub();
        progressUnsub();
        downloadedUnsub();
      };
    }

    return () => {
      statusUnsub();
      availableUnsub();
      notAvailableUnsub();
      errorUnsub();
      progressUnsub();
      downloadedUnsub();
    };
  }, [isAvailable, autoCheck, checkForUpdates]);

  return {
    status,
    updateInfo,
    progress,
    error,
    checkForUpdates,
    installUpdate,
  };
}
