import type { ManualVerificationView } from './views';

export type ManualPerformanceProfilerSample = Readonly<{
  route: ManualVerificationView;
  action: string;
  phase: 'mount' | 'update' | 'nested-update';
  actualDuration: number;
  baseDuration: number;
  startTime: number;
  commitTime: number;
  classification: 'production' | 'development-strict-mode-probe';
}>;

export type ManualPerformanceProfilerSnapshot = Readonly<{
  samples: readonly ManualPerformanceProfilerSample[];
  excludedDevelopmentProbes: readonly ManualPerformanceProfilerSample[];
}>;

export type ManualPerformanceProfiler = Readonly<{
  reset: (action?: string) => void;
  read: () => ManualPerformanceProfilerSnapshot;
}>;

type ManualPerformanceProfilerRecorder = ManualPerformanceProfiler & {
  record: (sample: Omit<ManualPerformanceProfilerSample, 'action' | 'classification'>) => void;
};

declare global {
  interface Window {
    __fmclPerformanceProfiler?: ManualPerformanceProfiler;
  }
}

export function createManualPerformanceProfiler(isDevelopment: boolean): ManualPerformanceProfilerRecorder {
  let action = 'initial-render';
  let samples: ManualPerformanceProfilerSample[] = [];
  let excludedDevelopmentProbes: ManualPerformanceProfilerSample[] = [];

  return {
    reset(nextAction = 'initial-render') {
      action = nextAction.trim() || 'initial-render';
      samples = [];
      excludedDevelopmentProbes = [];
    },
    read() {
      return {
        samples: [...samples],
        excludedDevelopmentProbes: [...excludedDevelopmentProbes],
      };
    },
    record(sample) {
      const observation: ManualPerformanceProfilerSample = {
        ...sample,
        action,
        classification: isDevelopment ? 'development-strict-mode-probe' : 'production',
      };

      if (isDevelopment) {
        excludedDevelopmentProbes = [...excludedDevelopmentProbes, observation];
      } else {
        samples = [...samples, observation];
      }
    },
  };
}

const manualPerformanceProfiler = createManualPerformanceProfiler(import.meta.env.DEV);

if (typeof window !== 'undefined') {
  window.__fmclPerformanceProfiler = manualPerformanceProfiler;
}

export function getManualPerformanceProfiler(): ManualPerformanceProfiler {
  return manualPerformanceProfiler;
}

export const manualPerformanceProfilerRecorder = manualPerformanceProfiler;
