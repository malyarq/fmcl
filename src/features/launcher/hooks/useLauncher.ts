import { useEffect } from 'react';
import type { RefObject } from 'react';
import { useSettings } from '../../../contexts/SettingsContext';
import { useModpack } from '../../../contexts/ModpackContext';
import { launcherIPC } from '../../../services/ipc/launcherIPC';
import { useLauncherState } from './useLauncherState';
import { useLauncherIPC } from './useLauncherIPC';
import { saveLastGame } from '../../launch/services/lastGame';
import { getLaunchStageTitle, isForceRestartAllowed, type LaunchStage } from '../services/launcherService';

function translateWithFallback(t: (key: string) => string, key: string, fallback: string) {
  const translated = t(key);
  return translated === key ? fallback : translated;
}

interface LaunchOptions {
  nickname: string;
  version: string;
  ram: number;
  hideLauncher: boolean;
  javaPath?: string;
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
  const state = useLauncherState();
  const { t, minecraftPath, autoDownloadThreads, downloadThreads, maxSockets } = useSettings();
  const { effectiveModpackId: modpackId, config: modpackConfig } = useModpack();
  const javaPath = modpackConfig?.java?.path || '';

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
    if (!launcherIPC.isAvailable()) {
      state.setStatusText('Launcher not available');
      state.setStatusDetail('');
      state.setLaunchStage('failed');
      state.appendLog('[SYSTEM] Launcher API not available. Is preload loaded?');
      return;
    }

    state.setIsLaunching(true);
    state.setProgress(null);
    state.setLaunchStage('preparing');
    state.setStatusText(getLaunchStageTitle('preparing', t) || t('status.initializing'));
    state.setStatusDetail(translateWithFallback(t, 'status.preparing_detail', 'Checking runtime requirements and selected pack.'));
    state.appendLog('Starting launch sequence...');

    try {
      await launcherIPC.launch({
        nickname: options.nickname,
        version: options.version,
        ram: options.ram,
        hideLauncher: options.hideLauncher,
        javaPath: options.javaPath ?? javaPath,
        gamePath: minecraftPath || undefined,
        modpackId: modpackId || undefined,
        // Legacy alias for backward compatibility
        instanceId: modpackId || undefined,
        autoDownloadThreads,
        downloadThreads,
        maxSockets,
        useOptiFine: options.useOptiFine ?? false,
      });
      state.setStatusText(t('status.game_running'));

      const loader = modpackConfig?.runtime?.modLoader?.type ?? 'vanilla';
      const loaderNorm = loader === 'quilt' ? 'fabric' : loader;
      if (modpackId && ['vanilla', 'forge', 'fabric', 'neoforge'].includes(loaderNorm)) {
        const mc = modpackConfig?.runtime?.minecraft ?? '1.20.1';
        saveLastGame(modpackId, {
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
      state.appendLog(`Error: ${e}`);
      state.setLaunchStage('failed');
      state.setStatusText(getLaunchStageTitle('failed', t));
      state.setStatusDetail(
        e instanceof Error && e.message
          ? e.message
          : translateWithFallback(t, 'status.failed_detail', 'Review the error and try launching again.')
      );
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
