import { useCallback, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { LaunchStage } from '../services/launcherService';

export function useLauncherState() {
  const [progress, setProgress] = useState(0);
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
