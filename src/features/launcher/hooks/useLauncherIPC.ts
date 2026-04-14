import { useEffect } from 'react';
import { launcherIPC } from '../../../services/ipc/launcherIPC';
import {
  getLaunchStatusFromLog,
  getProgressStatus,
  isTrackableProgressType,
  toPercent,
  type LaunchStage,
  type LauncherProgressEvent,
} from '../services/launcherService';

function translateWithFallback(t: (key: string) => string, key: string, fallback: string) {
  const translated = t(key);
  return translated === key ? fallback : translated;
}

export function useLauncherIPC(params: {
  t: (key: string) => string;
  onAppendLog: (log: string) => void;
  onSetProgress: (percent: number) => void;
  onSetStatusText: (text: string) => void;
  onSetStatusDetail: (text: string) => void;
  onSetLaunchStage: (stage: LaunchStage) => void;
  onSetLaunching: (isLaunching: boolean) => void;
  getLaunchStage: () => LaunchStage;
}) {
  const { t, onAppendLog, onSetProgress, onSetStatusText, onSetStatusDetail, onSetLaunchStage, onSetLaunching, getLaunchStage } = params;

  // Subscribe to launcher events once for the active language.
  useEffect(() => {
    if (!launcherIPC.isAvailable()) {
      onSetStatusText('');
      onSetStatusDetail('');
      onSetLaunchStage('failed');
      onAppendLog('[SYSTEM] Launcher API not available. Is preload loaded?');
      return;
    }

    const unsubLog = launcherIPC.onLog((log) => {
      onAppendLog(log);
      const nextStatus = getLaunchStatusFromLog(log, t);
      if (nextStatus) {
        onSetLaunchStage(nextStatus.stage);
        onSetStatusText(nextStatus.title);
        onSetStatusDetail(nextStatus.detail);
      }
    });

    const unsubProgress = launcherIPC.onProgress((data: LauncherProgressEvent) => {
      if (isTrackableProgressType(data.type)) {
        const percent = toPercent(data.task, data.total);
        const nextStatus = getProgressStatus(data, t);
        onSetProgress(percent);
        onSetLaunchStage(nextStatus.stage);
        onSetStatusText(nextStatus.title);
        onSetStatusDetail(nextStatus.detail);
      }
    });

    const unsubClose = launcherIPC.onClose((code) => {
      onAppendLog(`[SYSTEM] Game session ended (Code: ${code})`);
      const currentStage = getLaunchStage();
      if (code !== 0 && currentStage !== 'failed') {
        onSetLaunchStage('failed');
        onSetStatusText(translateWithFallback(t, 'status.failed', 'Launch Failed'));
        onSetStatusDetail(
          translateWithFallback(t, 'status.exit_code', 'Minecraft closed with exit code {{code}}').replace('{{code}}', String(code))
        );
      } else if (currentStage !== 'failed') {
        onSetLaunchStage('idle');
        onSetStatusText('');
        onSetStatusDetail('');
      }
      onSetLaunching(false);
      onSetProgress(0);
    });

    return () => {
      unsubLog();
      unsubProgress();
      unsubClose();
    };
  }, [t, onAppendLog, onSetProgress, onSetStatusText, onSetStatusDetail, onSetLaunchStage, onSetLaunching, getLaunchStage]);

  const sendStdin = async (data: string) => {
    if (launcherIPC.isAvailable() && launcherIPC.has('sendStdin')) {
      await launcherIPC.sendStdin(data);
    }
  };

  return { sendStdin };
}
