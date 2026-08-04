import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { useModpack } from '../../../contexts/ModpackContext';
import type { ModLoaderType } from '../../../contexts/instances/types';
import {
  computeLaunchVersion,
  isLoaderSupported,
  loadPlayerNickname,
  savePlayerNickname,
  shouldDisableOptiFine,
  type LaunchStage,
  type LoaderType,
} from '../services/launcherService';

export interface LauncherVersionInventory {
  forgeVersions: string[];
  fabricVersions: string[];
  optiFineVersions: string[];
  neoForgeVersions: string[];
}

/** Canonical renderer-owned selection state; native launch authority remains in main. */
export function useLauncherState(params: LauncherVersionInventory) {
  const { forgeVersions, fabricVersions, optiFineVersions, neoForgeVersions } = params;
  const [nickname, setNickname] = useState(loadPlayerNickname);
  const [isOffline, setIsOffline] = useState(() => !navigator.onLine);
  const {
    config: instanceConfig,
    isReady,
    setRuntimeMinecraft,
    setRuntimeLoader,
    patchConfig,
  } = useModpack();

  useEffect(() => savePlayerNickname(nickname), [nickname]);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const version = isReady ? (instanceConfig?.runtime?.minecraft ?? '') : '';
  const loaderType = (isReady ? (instanceConfig?.runtime?.modLoader?.type ?? 'vanilla') : 'vanilla') as LoaderType;
  const useForge = loaderType === 'forge';
  const useFabric = loaderType === 'fabric';
  const useNeoForge = loaderType === 'neoforge';
  const useOptiFine = Boolean(instanceConfig?.game?.useOptiFine);

  const setVersion = useCallback((next: string) => setRuntimeMinecraft(next), [setRuntimeMinecraft]);
  const setUseForge = useCallback((enabled: boolean) => setRuntimeLoader(enabled ? 'forge' : 'vanilla'), [setRuntimeLoader]);
  const setUseFabric = useCallback((enabled: boolean) => setRuntimeLoader(enabled ? 'fabric' : 'vanilla'), [setRuntimeLoader]);
  const setUseNeoForge = useCallback((enabled: boolean) => setRuntimeLoader(enabled ? 'neoforge' : 'vanilla'), [setRuntimeLoader]);
  const setLoader = useCallback((loader: Exclude<LoaderType, 'quilt'>) => {
    setRuntimeLoader(loader as ModLoaderType);
  }, [setRuntimeLoader]);
  const setUseOptiFine = useCallback((enabled: boolean) => {
    if (!instanceConfig) return;
    patchConfig({
      game: {
        ...(instanceConfig.game ?? {}),
        useOptiFine: enabled,
      },
    });
  }, [instanceConfig, patchConfig]);

  useEffect(() => {
    if (!isLoaderSupported({ loaderType, mcVersion: version, forgeVersions, fabricVersions, neoForgeVersions })) {
      const timeout = window.setTimeout(() => setRuntimeLoader('vanilla'), 0);
      return () => window.clearTimeout(timeout);
    }
  }, [fabricVersions, forgeVersions, loaderType, neoForgeVersions, setRuntimeLoader, version]);

  useEffect(() => {
    if (!shouldDisableOptiFine({ useOptiFine, mcVersion: version, loaderType, optiFineVersions })) return;
    const timeout = window.setTimeout(() => setUseOptiFine(false), 0);
    return () => window.clearTimeout(timeout);
  }, [loaderType, optiFineVersions, setUseOptiFine, useOptiFine, version]);

  const launchVersion = useMemo(
    () => computeLaunchVersion({ loaderType, mcVersion: version }),
    [loaderType, version],
  );

  return {
    modpackConfig: instanceConfig,
    nickname,
    setNickname,
    version,
    setVersion,
    loaderType,
    useForge,
    setUseForge,
    useFabric,
    setUseFabric,
    useNeoForge,
    setUseNeoForge,
    setLoader,
    useOptiFine,
    setUseOptiFine,
    isOffline,
    launchVersion,
  };
}

/** Internal process/session state for the active launcher invocation. */
export function useLauncherProcessState() {
  const [progress, setProgress] = useState<number | null>(null);
  const [statusText, setStatusText] = useState('');
  const [statusDetail, setStatusDetail] = useState('');
  const [logs, setLogs] = useState<string[]>([]);
  const [isLaunching, setIsLaunching] = useState(false);
  const [launchStage, setLaunchStageState] = useState<LaunchStage>('idle');

  // `useRef(null)` would widen to `HTMLDivElement | null` and cause invariant RefObject mismatches.
  const logEndRef = useRef<HTMLDivElement>(null!) as RefObject<HTMLDivElement>;
  const launchStageRef = useRef<LaunchStage>('idle');

  const appendLog = useCallback((log: string) => setLogs((prev) => [...prev, log]), []);
  const resetLogs = useCallback(() => setLogs([]), []);
  const setLaunchStage = useCallback((stage: LaunchStage) => {
    launchStageRef.current = stage;
    setLaunchStageState(stage);
  }, []);
  const getLaunchStage = useCallback(() => launchStageRef.current, []);

  return {
    progress,
    setProgress,
    statusText,
    setStatusText,
    statusDetail,
    setStatusDetail,
    logs,
    setLogs,
    appendLog,
    resetLogs,
    isLaunching,
    setIsLaunching,
    launchStage,
    setLaunchStage,
    getLaunchStage,
    logEndRef,
  };
}
