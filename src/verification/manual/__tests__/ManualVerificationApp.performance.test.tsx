// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import {
  createManualPerformanceProfiler,
  getManualPerformanceProfiler,
} from '../performanceProfiler';

const sample = {
  route: 'phase-41-surfaces-en' as const,
  phase: 'update' as const,
  actualDuration: 4.5,
  baseDuration: 7.25,
  startTime: 100,
  commitTime: 110,
};

describe('manual verification performance profiler', () => {
  it('records resettable production samples with route, action, phase, and timing evidence', () => {
    const profiler = createManualPerformanceProfiler(false);

    profiler.reset('blur-scroll');
    profiler.record(sample);

    expect(profiler.read()).toEqual({
      samples: [{ ...sample, action: 'blur-scroll', classification: 'production' }],
      excludedDevelopmentProbes: [],
    });

    profiler.reset();
    expect(profiler.read()).toEqual({ samples: [], excludedDevelopmentProbes: [] });
    expect(getManualPerformanceProfiler()).toBe(window.__fmclPerformanceProfiler);
  });

  it('labels and excludes development StrictMode probes from production observations', () => {
    const profiler = createManualPerformanceProfiler(true);

    profiler.record(sample);

    expect(profiler.read()).toEqual({
      samples: [],
      excludedDevelopmentProbes: [{
        ...sample,
        action: 'initial-render',
        classification: 'development-strict-mode-probe',
      }],
    });
  });
});
