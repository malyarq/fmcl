import { useEffect } from 'react';
import { launcherIPC } from '../../../services/ipc/launcherIPC';
import {
  getLaunchStageTitle,
  getLaunchStatusFromLog,
  getLauncherSessionEndedLog,
  getLauncherUnavailableDetail,
  getMeaningfulProgressPercent,
  getProgressStatus,
  isTrackableProgressType,
  shouldApplyLaunchStatus,
  type LaunchStage,
  type LauncherProgressEvent,
} from '../services/launcherService';

function translateWithFallback(t: (key: string) => string, key: string, fallback: string) {
  const translated = t(key);
  return translated === key ? fallback : translated;
}

export function useLauncherIPC(params: {
  t: (key: string, params?: Record<string, string | number>) => string;
  onAppendLog: (log: string) => void;
  onSetProgress: (percent: number) => void;
  onSetStatusText: (text: string) => void;
  onSetStatusDetail: (text: string) => void;
  onSetLaunchStage: (stage: LaunchStage) => void;
  onSetLaunching: (isLaunching: boolean) => void;
  onClearProgress: () => void;
  getLaunchStage: () => LaunchStage;
}) {
  const {
    t,
    onAppendLog,
    onSetProgress,
    onSetStatusText,
    onSetStatusDetail,
    onSetLaunchStage,
    onSetLaunching,
    onClearProgress,
    getLaunchStage,
  } = params;

  // Subscribe to launcher events once for the active language.
  useEffect(() => {
    if (!launcherIPC.isAvailable()) {
      const unavailableDetail = getLauncherUnavailableDetail(t);
      onSetStatusText(getLaunchStageTitle('failed', t));
      onSetStatusDetail(unavailableDetail);
      onSetLaunchStage('failed');
      onAppendLog(unavailableDetail);
      return;
    }

    const unsubLog = launcherIPC.onLog((log) => {
      onAppendLog(log);
      const nextStatus = getLaunchStatusFromLog(log, t);
      if (nextStatus && shouldApplyLaunchStatus({ currentStage: getLaunchStage(), nextStage: nextStatus.stage, source: 'log' })) {
        onSetLaunchStage(nextStatus.stage);
        onSetStatusText(nextStatus.title);
        onSetStatusDetail(nextStatus.detail);
      }
    });

    const unsubProgress = launcherIPC.onProgress((data: LauncherProgressEvent) => {
      if (isTrackableProgressType(data.type)) {
        const percent = getMeaningfulProgressPercent(data);
        const nextStatus = getProgressStatus(data, t);
        if (percent === null) {
          onClearProgress();
        } else {
          onSetProgress(percent);
        }
        onSetLaunchStage(nextStatus.stage);
        onSetStatusText(nextStatus.title);
        onSetStatusDetail(nextStatus.detail);
      }
    });

    const unsubClose = launcherIPC.onClose((code) => {
      onAppendLog(getLauncherSessionEndedLog(code, t));
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
      onClearProgress();
    });

    return () => {
      unsubLog();
      unsubProgress();
      unsubClose();
    };
  }, [
    t,
    onAppendLog,
    onSetProgress,
    onSetStatusText,
    onSetStatusDetail,
    onSetLaunchStage,
    onSetLaunching,
    onClearProgress,
    getLaunchStage,
  ]);

  const sendStdin = async (data: string) => {
    if (launcherIPC.isAvailable() && launcherIPC.has('sendStdin')) {
      await launcherIPC.sendStdin(data);
    }
  };

  return { sendStdin };
}
