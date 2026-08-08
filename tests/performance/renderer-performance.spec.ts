import childProcess from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { expect, test, type Page } from '@playwright/test';
import {
  QUALITY_MANUAL_ROUTES,
  getQualityManualRoute,
  type QualityManualRoute,
} from '../../src/verification/manual/qualityRoutes';
import { assertPerformanceEvidence } from '../quality/evidenceSchema';
import { navigateToQualityManualRoute } from '../quality/manualRouteHarness';

const require = createRequire(import.meta.url);
const budgetPath = path.resolve(process.cwd(), 'quality/budgets/renderer-performance.json');
const evidenceRoot = path.resolve(process.cwd(), 'dist', 'performance-evidence');

type RuntimeRouteBudget = Readonly<{
  id: string;
  rerenderMedianLimit: number;
  rerenderP95Limit: number;
}>;

type RuntimeBudget = Readonly<{
  measurement: Readonly<{
    warmupRuns: number;
    sampleRuns: number;
    settleMs: number;
    blurScrollFrames: number;
    aggregation: 'median-and-p95-nearest-rank';
  }>;
  routes: readonly RuntimeRouteBudget[];
  longTasks: Readonly<{ maxTasksOver50ms: number; maxTaskDurationMs: number }>;
  blurScroll: Readonly<{ maxP95FrameMs: number; minFramesAtOrBelow16_7ms: number; maxFrameMs: number }>;
}>;

type ProfilerSample = Readonly<{
  phase: 'mount' | 'update' | 'nested-update';
  actualDuration: number;
  classification: 'production' | 'development-strict-mode-probe';
}>;

type RouteRun = Readonly<{
  profiler: readonly ProfilerSample[];
  longTaskDurations: readonly number[];
}>;

type BlurScrollSample = Readonly<{
  targetSelector: string;
  scrollRange: number;
  scrollTopChanges: number;
  frames: readonly number[];
  framesAtOrBelow16_7ms: number;
  framesAtOrBelow16_7msRatio: number;
  frameMedianMs: number;
  frameP95Ms: number;
  frameMaxMs: number;
}>;

type BlurScrollMeasurement = Readonly<{
  targetSelector: string;
  scrollRange: number;
  scrollTopChanges: number;
  frames: readonly number[];
}>;

type BlurScrollAggregate = Readonly<{
  samples: readonly BlurScrollSample[];
  frames: readonly number[];
  sampleRatios: readonly number[];
  framesAtOrBelow16_7msRatioMedian: number;
  frameMedianMs: number;
  frameP95Ms: number;
  frameMaxMs: number;
}>;

function requireFiniteNumber(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be a non-negative finite number.`);
  }
  return value;
}

function requirePositiveInteger(value: unknown, label: string): number {
  const number = requireFiniteNumber(value, label);
  if (!Number.isInteger(number) || number === 0) throw new Error(`${label} must be a positive integer.`);
  return number;
}

function blurScrollFramesPerCompleteSample(measurement: RuntimeBudget['measurement']): number {
  if (measurement.blurScrollFrames % measurement.sampleRuns !== 0) {
    throw new Error('runtime.measurement.blurScrollFrames must divide evenly across complete sample runs.');
  }
  return measurement.blurScrollFrames / measurement.sampleRuns;
}

function readRuntimeBudget(): RuntimeBudget {
  const budget = JSON.parse(fs.readFileSync(budgetPath, 'utf8')) as { runtime?: unknown };
  if (!budget.runtime || typeof budget.runtime !== 'object' || Array.isArray(budget.runtime)) {
    throw new Error('Renderer runtime performance budget is missing.');
  }

  const runtime = budget.runtime as Record<string, unknown>;
  const measurement = runtime.measurement as Record<string, unknown> | undefined;
  const longTasks = runtime.longTasks as Record<string, unknown> | undefined;
  const blurScroll = runtime.blurScroll as Record<string, unknown> | undefined;
  if (!measurement || !longTasks || !blurScroll || !Array.isArray(runtime.routes)) {
    throw new Error('Renderer runtime performance budget must declare measurement, routes, long-task, and blur-scroll limits.');
  }

  const routes = runtime.routes.map((route, index) => {
    if (!route || typeof route !== 'object' || Array.isArray(route)) throw new Error(`runtime.routes[${index}] must be an object.`);
    const value = route as Record<string, unknown>;
    if (typeof value.id !== 'string' || !getQualityManualRoute(value.id)) throw new Error(`runtime.routes[${index}] has an unknown route.`);
    return {
      id: value.id,
      rerenderMedianLimit: requireFiniteNumber(value.rerenderMedianLimit, `runtime.routes[${index}].rerenderMedianLimit`),
      rerenderP95Limit: requireFiniteNumber(value.rerenderP95Limit, `runtime.routes[${index}].rerenderP95Limit`),
    };
  });

  if (routes.length !== QUALITY_MANUAL_ROUTES.length || new Set(routes.map((route) => route.id)).size !== routes.length) {
    throw new Error('Renderer runtime performance budget must declare every quality route exactly once.');
  }

  return {
    measurement: {
      warmupRuns: requirePositiveInteger(measurement.warmupRuns, 'runtime.measurement.warmupRuns'),
      sampleRuns: requirePositiveInteger(measurement.sampleRuns, 'runtime.measurement.sampleRuns'),
      settleMs: requireFiniteNumber(measurement.settleMs, 'runtime.measurement.settleMs'),
      blurScrollFrames: requirePositiveInteger(measurement.blurScrollFrames, 'runtime.measurement.blurScrollFrames'),
      aggregation: measurement.aggregation === 'median-and-p95-nearest-rank'
        ? measurement.aggregation
        : (() => { throw new Error('runtime.measurement.aggregation must use median-and-p95-nearest-rank.'); })(),
    },
    routes,
    longTasks: {
      maxTasksOver50ms: requireFiniteNumber(longTasks.maxTasksOver50ms, 'runtime.longTasks.maxTasksOver50ms'),
      maxTaskDurationMs: requireFiniteNumber(longTasks.maxTaskDurationMs, 'runtime.longTasks.maxTaskDurationMs'),
    },
    blurScroll: {
      maxP95FrameMs: requireFiniteNumber(blurScroll.maxP95FrameMs, 'runtime.blurScroll.maxP95FrameMs'),
      minFramesAtOrBelow16_7ms: requireFiniteNumber(blurScroll.minFramesAtOrBelow16_7ms, 'runtime.blurScroll.minFramesAtOrBelow16_7ms'),
      maxFrameMs: requireFiniteNumber(blurScroll.maxFrameMs, 'runtime.blurScroll.maxFrameMs'),
    },
  };
}

function median(samples: readonly number[]): number {
  if (samples.length === 0) throw new Error('Cannot aggregate an empty performance sample set.');
  const sorted = [...samples].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function p95(samples: readonly number[]): number {
  return nearestRank(samples, 0.95);
}

function nearestRank(samples: readonly number[], percentile: number): number {
  if (samples.length === 0) throw new Error('Cannot aggregate an empty performance sample set.');
  if (!Number.isFinite(percentile) || percentile <= 0 || percentile > 1) {
    throw new Error('Performance percentile must be in the interval (0, 1].');
  }
  const sorted = [...samples].sort((left, right) => left - right);
  return sorted[Math.ceil(sorted.length * percentile) - 1];
}

function summarizeBlurScrollSample(measurement: BlurScrollMeasurement): BlurScrollSample {
  if (measurement.frames.length === 0) throw new Error('Blur-scroll sample must contain consecutive animation frames.');
  const { frames } = measurement;
  const framesAtOrBelow16_7ms = frames.filter((duration) => duration <= 16.7).length;
  return {
    ...measurement,
    frames,
    framesAtOrBelow16_7ms,
    framesAtOrBelow16_7msRatio: framesAtOrBelow16_7ms / frames.length,
    frameMedianMs: median(frames),
    frameP95Ms: nearestRank(frames, 0.95),
    frameMaxMs: nearestRank(frames, 1),
  };
}

function aggregateBlurScrollSamples(samples: readonly BlurScrollSample[]): BlurScrollAggregate {
  if (samples.length === 0) throw new Error('Cannot aggregate an empty blur-scroll sample set.');
  const frames = samples.flatMap((sample) => sample.frames);
  const sampleRatios = samples.map((sample) => sample.framesAtOrBelow16_7msRatio);
  return {
    samples,
    frames,
    sampleRatios,
    framesAtOrBelow16_7msRatioMedian: median(sampleRatios),
    frameMedianMs: median(frames),
    frameP95Ms: nearestRank(frames, 0.95),
    frameMaxMs: nearestRank(frames, 1),
  };
}

function assertAtMost(label: string, actual: number, limit: number, failures: string[]): void {
  if (actual > limit) failures.push(`${label}: actual=${actual} limit=${limit}`);
}

function assertAtLeast(label: string, actual: number, limit: number, failures: string[]): void {
  if (actual < limit) failures.push(`${label}: actual=${actual} limit=${limit}`);
}

async function installLongTaskObserver(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const observed: number[] = [];
    const Observer = window.PerformanceObserver;
    if (typeof Observer === 'function' && PerformanceObserver.supportedEntryTypes.includes('longtask')) {
      new Observer((list) => {
        for (const entry of list.getEntries()) observed.push(entry.duration);
      }).observe({ type: 'longtask', buffered: true });
    }
    (window as typeof window & { __fmclLongTaskDurations?: number[] }).__fmclLongTaskDurations = observed;
  });
}

async function collectRouteRun(page: Page, route: QualityManualRoute, settleMs: number): Promise<RouteRun> {
  await navigateToQualityManualRoute(page, route);
  await page.waitForTimeout(settleMs);
  return page.evaluate(() => {
    const profiler = window.__fmclPerformanceProfiler;
    if (!profiler) throw new Error('Production performance Profiler bridge is missing.');
    const snapshot = profiler.read();
    if (snapshot.excludedDevelopmentProbes.length > 0) {
      throw new Error('Development StrictMode Profiler probes cannot satisfy production performance evidence.');
    }
    if (snapshot.samples.length === 0 || snapshot.samples.some((sample) => sample.classification !== 'production')) {
      throw new Error('Production performance Profiler bridge returned no production observations.');
    }
    return {
      profiler: snapshot.samples.map((sample) => ({
        phase: sample.phase,
        actualDuration: sample.actualDuration,
        classification: sample.classification,
      })),
      longTaskDurations: (() => {
        const observed = (window as typeof window & { __fmclLongTaskDurations?: number[] }).__fmclLongTaskDurations ?? [];
        const durations = [...observed];
        observed.length = 0;
        return durations;
      })(),
    };
  });
}

async function collectBlurScrollFrames(page: Page, route: QualityManualRoute, frameCount: number): Promise<BlurScrollMeasurement> {
  if (!route.blurScrollTarget) throw new Error(`Blur-scroll route is missing an explicit scroll owner: ${route.id}`);
  return page.evaluate(async ({ targetSelector, samples }) => {
    const target = document.querySelector(targetSelector);
    if (!(target instanceof HTMLElement)) {
      throw new Error(`Blur-scroll target is missing: ${targetSelector}`);
    }
    const frames: number[] = [];
    const maximumScroll = target.scrollHeight - target.clientHeight;
    if (!Number.isFinite(maximumScroll) || maximumScroll <= 0) {
      throw new Error(`Blur-scroll target has no positive scroll range: ${targetSelector}`);
    }
    const initialScrollTop = target.scrollTop;
    const probeScrollTop = initialScrollTop < maximumScroll
      ? Math.min(maximumScroll, initialScrollTop + 1)
      : Math.max(0, initialScrollTop - 1);
    target.scrollTo({ top: probeScrollTop, behavior: 'auto' });
    if (target.scrollTop === initialScrollTop) {
      throw new Error(`Blur-scroll target failed to change scrollTop: ${targetSelector}`);
    }
    target.scrollTo({ top: initialScrollTop, behavior: 'auto' });
    if (target.scrollTop !== initialScrollTop) {
      throw new Error(`Blur-scroll target failed to restore scrollTop: ${targetSelector}`);
    }
    return new Promise<BlurScrollMeasurement>((resolve) => {
      let previousFrameTimestamp: number | undefined;
      let issuedScrolls = 0;
      let scrollTopChanges = 0;

      const issueNextScroll = () => {
        issuedScrolls += 1;
        const previousScrollTop = target.scrollTop;
        target.scrollTo({ top: maximumScroll * (issuedScrolls / samples), behavior: 'auto' });
        if (target.scrollTop !== previousScrollTop) scrollTopChanges += 1;
      };

      const sampleNextFrame = (timestamp: number) => {
        if (previousFrameTimestamp === undefined) {
          previousFrameTimestamp = timestamp;
          issueNextScroll();
          requestAnimationFrame(sampleNextFrame);
          return;
        }

        frames.push(timestamp - previousFrameTimestamp);
        previousFrameTimestamp = timestamp;
        if (frames.length === samples) {
          if (scrollTopChanges !== samples) {
            throw new Error(`Blur-scroll target failed to change scrollTop for every sampled frame: ${targetSelector}`);
          }
          resolve({ targetSelector, scrollRange: maximumScroll, scrollTopChanges, frames });
          return;
        }

        issueNextScroll();
        requestAnimationFrame(sampleNextFrame);
      };

      requestAnimationFrame(sampleNextFrame);
    });
  }, { targetSelector: route.blurScrollTarget, samples: frameCount });
}

function currentCommit(): string {
  return childProcess.execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
}

function currentNpmVersion(): string {
  return childProcess.execFileSync('npm', ['--version'], { encoding: 'utf8' }).trim();
}

async function assertProductionPreview(page: Page): Promise<{ commit: string; node: string; npm: string; vite: string }> {
  expect(test.info().project.name).toBe('performance-production');
  expect(test.info().project.use.baseURL).toBe('http://127.0.0.1:4174');
  const proofResponse = await page.request.get('/burrow-production-preview.json');
  expect(proofResponse.ok()).toBe(true);
  const proof = await proofResponse.json() as { commit?: string; mode?: string; profiling?: boolean };
  expect(proof).toEqual({ commit: currentCommit(), mode: 'production', profiling: true });
  return {
    commit: proof.commit!,
    node: process.versions.node,
    npm: currentNpmVersion(),
    vite: (require('vite/package.json') as { version: string }).version,
  };
}

const runtime = readRuntimeBudget();
const blurScrollFramesPerSample = blurScrollFramesPerCompleteSample(runtime.measurement);

test('performance-production rejects a controlled median/p95 threshold breach', () => {
  const failures: string[] = [];
  assertAtMost('controlled median', median([1, 2, 3, 4, 5]), 2, failures);
  assertAtMost('controlled p95', p95([1, 2, 3, 4, 5]), 4, failures);
  expect(failures).toEqual(['controlled median: actual=3 limit=2', 'controlled p95: actual=5 limit=4']);
});

test('performance-production tolerates one noisy rerender but rejects a sustained regression', () => {
  const oneNoisySampleFailures: string[] = [];
  const sustainedRegressionFailures: string[] = [];
  const oneNoisySample = [7, 7, 8];
  const sustainedRegression = [7, 8, 8];

  assertAtMost('one noisy sample median', median(oneNoisySample), 7, oneNoisySampleFailures);
  assertAtMost('one noisy sample p95', p95(oneNoisySample), 8, oneNoisySampleFailures);
  assertAtMost('sustained regression median', median(sustainedRegression), 7, sustainedRegressionFailures);
  assertAtMost('sustained regression p95', p95(sustainedRegression), 8, sustainedRegressionFailures);

  expect(oneNoisySampleFailures).toEqual([]);
  expect(sustainedRegressionFailures).toEqual(['sustained regression median: actual=8 limit=7']);
});

test('performance-production aggregates complete blur-scroll traces instead of failing one noisy sample', () => {
  const measurement = (frames: readonly number[]): BlurScrollMeasurement => ({
    targetSelector: '#controlled-scroll-owner',
    scrollRange: 100,
    scrollTopChanges: frames.length,
    frames,
  });
  const noisy = summarizeBlurScrollSample(measurement([10, 10, 20, 20, 20, 20, 20, 20, 20, 20]));
  const stable = summarizeBlurScrollSample(measurement([10, 10, 10, 10, 10, 20, 20, 20, 20, 20]));
  const oneNoisySample = aggregateBlurScrollSamples([noisy, stable, stable]);
  const sustainedRegression = aggregateBlurScrollSamples([noisy, noisy, stable]);

  expect(oneNoisySample.framesAtOrBelow16_7msRatioMedian).toBe(0.5);
  expect(oneNoisySample.frameP95Ms).toBe(20);
  expect(oneNoisySample.frameMaxMs).toBe(20);
  const passingFailures: string[] = [];
  const failingFailures: string[] = [];
  assertAtLeast('one noisy sample ratio', oneNoisySample.framesAtOrBelow16_7msRatioMedian, 0.36, passingFailures);
  assertAtLeast('sustained regression ratio', sustainedRegression.framesAtOrBelow16_7msRatioMedian, 0.36, failingFailures);
  expect(passingFailures).toEqual([]);
  expect(failingFailures).toEqual(['sustained regression ratio: actual=0.2 limit=0.36']);
});

test('performance-production rejects a fake or non-scrollable blur target', async ({ page }) => {
  const route = getQualityManualRoute('provider-content-en')!;

  await page.setContent('<div id="non-scrollable"></div>');
  await expect(collectBlurScrollFrames(page, { ...route, blurScrollTarget: '#non-scrollable' as typeof route.blurScrollTarget }, 3))
    .rejects.toThrow(/no positive scroll range/i);

  await page.setContent('<div id="fake-scroll-owner"></div>');
  await page.evaluate(() => {
    const target = document.querySelector('#fake-scroll-owner') as HTMLElement;
    Object.defineProperties(target, {
      scrollHeight: { value: 200 },
      clientHeight: { value: 100 },
    });
    target.scrollTo = () => undefined;
  });
  await expect(collectBlurScrollFrames(
    page,
    { ...route, blurScrollTarget: '#fake-scroll-owner' as typeof route.blurScrollTarget },
    3,
  )).rejects.toThrow(/failed to change scrollTop/i);
});

for (const routeBudget of runtime.routes) {
  const route = getQualityManualRoute(routeBudget.id)!;

  test(`records stable production performance evidence for ${route.id}`, async ({ page, browser }, testInfo) => {
    const blurScrollTimeoutMs = Math.ceil(
      runtime.measurement.blurScrollFrames * runtime.blurScroll.maxP95FrameMs * 1.25,
    ) + 30_000;
    testInfo.setTimeout(Math.max(testInfo.timeout, blurScrollTimeoutMs));
    const environment = await assertProductionPreview(page);
    await installLongTaskObserver(page);

    for (let index = 0; index < runtime.measurement.warmupRuns; index += 1) {
      await collectRouteRun(page, route, runtime.measurement.settleMs);
      if (route.blurScrollTarget) {
        await collectBlurScrollFrames(page, route, blurScrollFramesPerSample);
      }
    }

    const completeRuns: Array<Readonly<{ routeRun: RouteRun; blurScroll: BlurScrollSample | null }>> = [];
    for (let index = 0; index < runtime.measurement.sampleRuns; index += 1) {
      const routeRun = await collectRouteRun(page, route, runtime.measurement.settleMs);
      const blurScroll = route.blurScrollTarget
        ? summarizeBlurScrollSample(await collectBlurScrollFrames(page, route, blurScrollFramesPerSample))
        : null;
      completeRuns.push({ routeRun, blurScroll });
    }
    expect(completeRuns).toHaveLength(runtime.measurement.sampleRuns);

    const rerenderCommits = completeRuns.map((run) => run.routeRun.profiler.filter((sample) => sample.phase !== 'mount').length);
    const profilerDurations = completeRuns.flatMap((run) => run.routeRun.profiler.map((sample) => sample.actualDuration));
    const longTaskDurations = completeRuns.flatMap((run) => run.routeRun.longTaskDurations);
    const blurScroll = route.blurScrollTarget
      ? aggregateBlurScrollSamples(completeRuns.map((run) => run.blurScroll!).filter(Boolean))
      : null;
    const failures: string[] = [];

    assertAtMost(`${route.id} rerender median`, median(rerenderCommits), routeBudget.rerenderMedianLimit, failures);
    assertAtMost(`${route.id} rerender p95`, p95(rerenderCommits), routeBudget.rerenderP95Limit, failures);
    assertAtMost(`${route.id} long tasks over 50ms`, longTaskDurations.filter((duration) => duration > 50).length, runtime.longTasks.maxTasksOver50ms, failures);
    assertAtMost(`${route.id} longest task`, longTaskDurations.length === 0 ? 0 : Math.max(...longTaskDurations), runtime.longTasks.maxTaskDurationMs, failures);
    if (blurScroll) {
      for (const sample of blurScroll.samples) {
        assertAtLeast(
          `${route.id} blur-scroll ${sample.targetSelector} scroll range`,
          sample.scrollRange,
          1,
          failures,
        );
        assertAtLeast(
          `${route.id} blur-scroll ${sample.targetSelector} scrollTop changes`,
          sample.scrollTopChanges,
          sample.frames.length,
          failures,
        );
      }
      assertAtMost(`${route.id} blur-scroll p95`, blurScroll.frameP95Ms, runtime.blurScroll.maxP95FrameMs, failures);
      assertAtMost(`${route.id} blur-scroll max frame`, blurScroll.frameMaxMs, runtime.blurScroll.maxFrameMs, failures);
      assertAtLeast(
        `${route.id} blur-scroll median frames at or below 16.7ms`,
        blurScroll.framesAtOrBelow16_7msRatioMedian,
        runtime.blurScroll.minFramesAtOrBelow16_7ms,
        failures,
      );
    }

    const evidence = {
      kind: 'performance' as const,
      route,
      environment: {
        ...environment,
        browser: await browser.version(),
        platform: process.platform,
        architecture: process.arch,
        capturedAt: new Date().toISOString(),
      },
      samples: profilerDurations,
      aggregation: runtime.measurement.aggregation,
      thresholds: {
        rerenderMedianLimit: routeBudget.rerenderMedianLimit,
        rerenderP95Limit: routeBudget.rerenderP95Limit,
        maxTasksOver50ms: runtime.longTasks.maxTasksOver50ms,
        maxTaskDurationMs: runtime.longTasks.maxTaskDurationMs,
        maxP95FrameMs: runtime.blurScroll.maxP95FrameMs,
        minFramesAtOrBelow16_7ms: runtime.blurScroll.minFramesAtOrBelow16_7ms,
        maxFrameMs: runtime.blurScroll.maxFrameMs,
      },
      verdict: failures.length === 0 ? 'pass' as const : 'fail' as const,
      artifactPath: path.join('dist', 'performance-evidence', `${route.id}.json`),
      observations: {
        warmupRuns: runtime.measurement.warmupRuns,
        completeSampleRuns: runtime.measurement.sampleRuns,
        blurScrollFramesPerSample,
        blurScrollFramesAggregated: blurScroll?.frames.length ?? 0,
        rerenderCommits,
        rerenderMedian: median(rerenderCommits),
        rerenderP95: p95(rerenderCommits),
        longTaskDurations,
        blurFrames: blurScroll?.frames ?? [],
        blurFrameMedian: blurScroll?.frameMedianMs ?? null,
        blurFrameP95: blurScroll?.frameP95Ms ?? null,
        blurFrameMax: blurScroll?.frameMaxMs ?? null,
        blurFramesAtOrBelow16_7msRatioMedian: blurScroll?.framesAtOrBelow16_7msRatioMedian ?? null,
        blurScrollSamples: blurScroll?.samples ?? [],
        profiler: completeRuns.map((run) => run.routeRun.profiler),
      },
      failures,
    };
    assertPerformanceEvidence(evidence);
    fs.mkdirSync(evidenceRoot, { recursive: true });
    fs.writeFileSync(path.join(evidenceRoot, `${route.id}.json`), `${JSON.stringify(evidence, null, 2)}\n`);

    expect(failures, JSON.stringify(evidence, null, 2)).toEqual([]);
    await testInfo.attach(`${route.id}-performance-evidence`, {
      path: path.join(evidenceRoot, `${route.id}.json`),
      contentType: 'application/json',
    });
  });
}
