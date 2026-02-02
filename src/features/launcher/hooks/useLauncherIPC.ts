import { useEffect } from 'react';
import { launcherIPC } from '../../../services/ipc/launcherIPC';
import { isTrackableProgressType, toPercent, type LauncherProgressEvent } from '../services/launcherService';

export function useLauncherIPC(params: {
  t: (key: string) => string;
  onAppendLog: (log: string) => void;
  onSetProgress: (percent: number) => void;
  onSetStatusText: (text: string) => void;
  onSetLaunching: (isLaunching: boolean) => void;
}) {
  const { t, onAppendLog, onSetProgress, onSetStatusText, onSetLaunching } = params;

  // Subscribe to launcher events once for the active language.
  useEffect(() => {
    if (!launcherIPC.isAvailable()) {
      onSetStatusText('');
      onAppendLog('[SYSTEM] Launcher API not available. Is preload loaded?');
      return;
    }

    const unsubLog = launcherIPC.onLog((log) => {
      onAppendLog(log);
    });

    const unsubProgress = launcherIPC.onProgress((data: LauncherProgressEvent) => {
      if (isTrackableProgressType(data.type)) {
        const percent = toPercent(data.task, data.total);
        onSetProgress(percent);
        onSetStatusText(`${t('status.download_progress')} ${data.type}: ${Math.round(percent)}%`);
      }
    });

    const unsubClose = launcherIPC.onClose((code) => {
      onAppendLog(`[SYSTEM] Game session ended (Code: ${code})`);
      onSetStatusText('');
      onSetLaunching(false);
    });

    return () => {
      unsubLog();
      unsubProgress();
      unsubClose();
    };
  }, [t, onAppendLog, onSetProgress, onSetStatusText, onSetLaunching]);
}

