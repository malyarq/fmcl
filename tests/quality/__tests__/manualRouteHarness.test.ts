import { describe, expect, it } from 'vitest';
import { getQualityManualRoute } from '../../../src/verification/manual/qualityRoutes';
import {
  getManualVerificationRouteUrl,
  parseManualVerificationStatus,
} from '../manualRouteHarness';
import {
  assertAccessibilityEvidence,
  assertPerformanceEvidence,
  assertRouteRunEvidence,
} from '../evidenceSchema';

const route = getQualityManualRoute('network-lan-ru')!;

const environment = {
  commit: 'a'.repeat(40),
  node: '24.13.0',
  npm: '11.6.2',
  vite: '7.3.6',
  browser: 'Chromium 142.0.0',
  platform: 'darwin',
  architecture: 'arm64',
  capturedAt: '2026-08-04T21:31:30.000Z',
};

describe('manual route harness', () => {
  it('builds the existing manual verification URL and accepts only a matching rendered readiness payload', () => {
    expect(getManualVerificationRouteUrl(route)).toBe('/manual-verification.html?view=phase-42-lan-ru');
    expect(parseManualVerificationStatus(JSON.stringify(route.readiness), route)).toEqual(route.readiness);
  });

  it.each([
    ['missing', null],
    ['invalid JSON', '{'],
    ['not ready', JSON.stringify({ ...route.readiness, ready: false })],
    ['wrong view', JSON.stringify({ ...route.readiness, view: 'phase-42-tunnel-en' })],
    ['wrong step', JSON.stringify({ ...route.readiness, step: 'mounting' })],
  ])('fails closed for %s readiness status', (_case, rawStatus) => {
    expect(() => parseManualVerificationStatus(rawStatus, route)).toThrow(/verification status/i);
  });

  it('requires complete route, provenance, measurements, thresholds, verdict, and artifact evidence', () => {
    const routeRun = {
      kind: 'route-run' as const,
      route,
      environment,
      samples: [12.5, 13.5],
      aggregation: 'median',
      thresholds: { bodyOverflow: 0 },
      verdict: 'pass' as const,
      artifactPath: 'test-artifacts/quality/routes/network-lan-ru.json',
    };

    expect(assertRouteRunEvidence(routeRun)).toEqual(routeRun);
    expect(assertPerformanceEvidence({ ...routeRun, kind: 'performance' as const })).toEqual({
      ...routeRun,
      kind: 'performance',
    });
    expect(assertAccessibilityEvidence({ ...routeRun, kind: 'accessibility' as const })).toEqual({
      ...routeRun,
      kind: 'accessibility',
    });
    expect(() => assertPerformanceEvidence({ ...routeRun, kind: 'performance', samples: [] })).toThrow(/samples/i);
    expect(() => assertAccessibilityEvidence({ ...routeRun, kind: 'accessibility', environment: { ...environment, vite: '' } })).toThrow(/environment/i);
    expect(() => assertRouteRunEvidence({ ...routeRun, thresholds: {} })).toThrow(/thresholds/i);
    expect(() => assertRouteRunEvidence({ ...routeRun, verdict: 'unknown' })).toThrow(/verdict/i);
  });
});
