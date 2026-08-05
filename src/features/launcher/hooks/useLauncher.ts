import { useEffect } from 'react';
import type { RefObject } from 'react';
import { useSettings } from '../../../contexts/SettingsContext';
import { useEffectiveInstance } from '../../instances/hooks/useEffectiveInstance';
import { launcherIPC } from '../../../services/ipc/launcherIPC';
import { useLauncherProcessState } from './useLauncherState';
import { useLauncherIPC } from './useLauncherIPC';
import {
  getLaunchStageTitle,
  getLauncherUnavailableDetail,
  getVisibleLaunchFailureDetail,
  isForceRestartAllowed,
  saveRecentLaunch,
  type LaunchStage,
} from '../services/launcherService';
import { analyticsClient } from '../../analytics/analyticsClient';

function translateWithFallback(t: (key: string) => string, key: string, fallback: string) {
  const translated = t(key);
  return translated === key ? fallback : translated;
}

interface LaunchOptions {
  nickname: string;
  version: string;
  ram: number;
  hideLauncher: boolean;
  useOptiFine?: boolean;
}

export interface UseLauncherResult {
  isLaunching: boolean;
  progress?: number;
  launchStage: LaunchStage;
  statusText: string;
  statusDetail: string;
  canForceRestart: boolean;
  logs: string[];
  logEndRef: RefObject<HTMLDivElement>;
  handleLaunch: (options: LaunchOptions) => Promise<void>;
  copyLogs: () => void;
}

export const useLauncher = (): UseLauncherResult => {
  const state = useLauncherProcessState();
  const { t, autoDownloadThreads, downloadThreads, maxSockets } = useSettings();
  const effectiveInstance = useEffectiveInstance();
  const instanceId = effectiveInstance.status === 'ready' ? effectiveInstance.data.id : '';
  const modpackConfig = effectiveInstance.status === 'ready' ? effectiveInstance.data.snapshot : null;

  useLauncherIPC({
    t,
    onAppendLog: state.appendLog,
    onSetProgress: state.setProgress,
    onSetStatusText: state.setStatusText,
    onSetStatusDetail: state.setStatusDetail,
    onSetLaunchStage: state.setLaunchStage,
    onSetLaunching: state.setIsLaunching,
    onClearProgress: () => state.setProgress(null),
    getLaunchStage: state.getLaunchStage,
  });

  // Auto-scroll logs view to the newest entry.
  useEffect(() => {
    state.logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state.logs, state.logEndRef]);

  const handleLaunch = async (options: LaunchOptions) => {
    if (state.isLaunching) return;
    const loader = modpackConfig?.runtime?.modLoader?.type ?? 'vanilla';
    const loaderNorm = loader === 'quilt' ? 'fabric' : loader;
    const analyticsLoader = ['vanilla', 'forge', 'fabric', 'neoforge'].includes(loaderNorm)
      ? loaderNorm as 'vanilla' | 'forge' | 'fabric' | 'neoforge'
      : 'vanilla';

    if (!launcherIPC.isAvailable()) {
      void analyticsClient.capture('game_launch_failed', { failure_stage: 'ipc_unavailable', loader: analyticsLoader });
      const unavailableDetail = getLauncherUnavailableDetail(t);
      state.setStatusText(getLaunchStageTitle('failed', t));
      state.setStatusDetail(unavailableDetail);
      state.setLaunchStage('failed');
      state.appendLog(unavailableDetail);
      return;
    }

    state.setIsLaunching(true);
    state.setProgress(null);
    state.setLaunchStage('preparing');
    state.setStatusText(getLaunchStageTitle('preparing', t) || t('status.initializing'));
    state.setStatusDetail(translateWithFallback(t, 'status.preparing_detail', 'Checking runtime requirements and selected pack.'));
    state.appendLog('Starting launch sequence...');
    void analyticsClient.capture('game_launch_started', { loader: analyticsLoader });

    try {
      await launcherIPC.launch({
        nickname: options.nickname,
        version: options.version,
        ram: options.ram,
        hideLauncher: options.hideLauncher,
        instanceId: instanceId || undefined,
        autoDownloadThreads,
        downloadThreads,
        maxSockets,
        useOptiFine: options.useOptiFine ?? false,
      });
      state.setStatusText(t('status.game_running'));
      void analyticsClient.capture('game_launch_succeeded', { loader: analyticsLoader });

      if (instanceId && ['vanilla', 'forge', 'fabric', 'neoforge'].includes(loaderNorm)) {
        const mc = modpackConfig?.runtime?.minecraft ?? '1.20.1';
        saveRecentLaunch(instanceId, {
          versionId: mc,
          nickname: options.nickname,
          loader: loaderNorm as 'vanilla' | 'forge' | 'fabric' | 'neoforge',
          launchVersion: options.version,
          timestamp: Date.now(),
        });
      }

      state.setProgress(null);
      state.setLaunchStage('waiting');
      state.setStatusText(getLaunchStageTitle('waiting', t));
      state.setStatusDetail(
        translateWithFallback(t, 'status.waiting_detail', 'Minecraft process started. Waiting for the game window and logs.')
      );
    } catch (e) {
      void analyticsClient.capture('game_launch_failed', { failure_stage: 'launch', loader: analyticsLoader });
      const detail = getVisibleLaunchFailureDetail(e, t);
      state.appendLog(detail);
      state.setLaunchStage('failed');
      state.setStatusText(getLaunchStageTitle('failed', t));
      state.setStatusDetail(detail);
      state.setIsLaunching(false);
      state.setProgress(null);
    }
  };

  const copyLogs = () => {
    navigator.clipboard.writeText(state.logs.join('\n'));
  };

  return {
    isLaunching: state.isLaunching,
    progress: state.progress ?? undefined,
    launchStage: state.launchStage,
    statusText: state.statusText,
    statusDetail: state.statusDetail,
    canForceRestart: isForceRestartAllowed(state.launchStage),
    logs: state.logs,
    logEndRef: state.logEndRef,
    handleLaunch,
    copyLogs,
  };
};
