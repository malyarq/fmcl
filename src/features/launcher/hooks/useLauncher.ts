import { useEffect } from 'react';
import type { RefObject } from 'react';
import { useSettings } from '../../../contexts/SettingsContext';
import { useModpack } from '../../../contexts/ModpackContext';
import { launcherIPC } from '../../../services/ipc/launcherIPC';
import { useLauncherState } from './useLauncherState';
import { useLauncherIPC } from './useLauncherIPC';

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
  progress: number;
  statusText: string;
  logs: string[];
  logEndRef: RefObject<HTMLDivElement>;
  handleLaunch: (options: LaunchOptions) => Promise<void>;
  copyLogs: () => void;
}

export const useLauncher = (): UseLauncherResult => {
  const state = useLauncherState();
  const { t, minecraftPath, downloadProvider, autoDownloadThreads, downloadThreads, maxSockets } = useSettings();
  const { selectedId: modpackId, config: modpackConfig } = useModpack();
  const javaPath = modpackConfig?.java?.path || '';

  useLauncherIPC({
    t,
    onAppendLog: state.appendLog,
    onSetProgress: state.setProgress,
    onSetStatusText: state.setStatusText,
    onSetLaunching: state.setIsLaunching,
  });

  // Auto-scroll logs view to the newest entry.
  useEffect(() => {
    state.logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state.logs, state.logEndRef]);

  const handleLaunch = async (options: LaunchOptions) => {
    if (state.isLaunching) return;
    if (!launcherIPC.isAvailable()) {
      state.setStatusText('Launcher not available');
      state.appendLog('[SYSTEM] Launcher API not available. Is preload loaded?');
      return;
    }

    state.setIsLaunching(true);
    state.setProgress(0);
    state.setStatusText(t('status.initializing'));
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
        downloadProvider,
        autoDownloadThreads,
        downloadThreads,
        maxSockets,
        useOptiFine: options.useOptiFine ?? false,
      });
      state.setStatusText(t('status.game_running'));
    } catch (e) {
      state.appendLog(`Error: ${e}`);
      state.setStatusText('Launch Failed');
      state.setIsLaunching(false);
    }
  };

  const copyLogs = () => {
    navigator.clipboard.writeText(state.logs.join('\n'));
  };

  return {
    isLaunching: state.isLaunching,
    progress: state.progress,
    statusText: state.statusText,
    logs: state.logs,
    logEndRef: state.logEndRef,
    handleLaunch,
    copyLogs,
  };
};

