import { useRef, useState } from 'react';
import type { RefObject } from 'react';

export function useLauncherState() {
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [logs, setLogs] = useState<string[]>([]);
  const [isLaunching, setIsLaunching] = useState(false);

  // `useRef(null)` would widen to `HTMLDivElement | null` and cause invariant RefObject mismatches.
  const logEndRef = useRef<HTMLDivElement>(null!) as RefObject<HTMLDivElement>;

  const appendLog = (log: string) => setLogs((prev) => [...prev, log]);
  const resetLogs = () => setLogs([]);

  return {
    progress,
    setProgress,
    statusText,
    setStatusText,
    logs,
    setLogs,
    appendLog,
    resetLogs,
    isLaunching,
    setIsLaunching,
    logEndRef,
  };
}

