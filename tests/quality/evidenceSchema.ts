import {
  getQualityManualRoute,
  type QualityManualRoute,
} from '../../src/verification/manual/qualityRoutes';

export type BrowserQualityEnvironment = Readonly<{
  commit: string;
  node: string;
  npm: string;
  vite: string;
  browser: string;
  platform: string;
  architecture: string;
  capturedAt: string;
}>;

export type BrowserQualityEvidenceKind = 'route-run' | 'performance' | 'accessibility';

export type BrowserQualityEvidence = Readonly<{
  kind: BrowserQualityEvidenceKind;
  route: QualityManualRoute;
  environment: BrowserQualityEnvironment;
  samples: readonly number[];
  aggregation: string;
  thresholds: Readonly<Record<string, number>>;
  verdict: 'pass' | 'fail';
  artifactPath: string;
}>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Browser quality evidence requires ${field}.`);
  }

  return value;
}

function requireKnownRoute(value: unknown): QualityManualRoute {
  if (!isRecord(value)) {
    throw new Error('Browser quality evidence requires a route.');
  }

  const id = requireString(value.id, 'route.id');
  const route = getQualityManualRoute(id);

  if (!route
    || value.view !== route.view
    || value.locale !== route.locale
    || !isRecord(value.viewport)
    || value.viewport.name !== route.viewport.name
    || value.viewport.width !== route.viewport.width
    || value.viewport.height !== route.viewport.height
    || value.interaction !== route.interaction
    || value.blurScrollTarget !== route.blurScrollTarget
    || !Array.isArray(value.forbiddenText)
    || value.forbiddenText.length !== route.forbiddenText.length
    || value.forbiddenText.some((text, index) => text !== route.forbiddenText[index])
    || !isRecord(value.readiness)
    || value.readiness.view !== route.readiness.view
    || value.readiness.ready !== route.readiness.ready
    || value.readiness.step !== route.readiness.step) {
    throw new Error(`Browser quality evidence references an unknown or altered route: ${id}.`);
  }

  return route;
}

function requireEnvironment(value: unknown): BrowserQualityEnvironment {
  if (!isRecord(value)) {
    throw new Error('Browser quality evidence requires environment provenance.');
  }

  const environment = {
    commit: requireString(value.commit, 'environment.commit'),
    node: requireString(value.node, 'environment.node'),
    npm: requireString(value.npm, 'environment.npm'),
    vite: requireString(value.vite, 'environment.vite'),
    browser: requireString(value.browser, 'environment.browser'),
    platform: requireString(value.platform, 'environment.platform'),
    architecture: requireString(value.architecture, 'environment.architecture'),
    capturedAt: requireString(value.capturedAt, 'environment.capturedAt'),
  };

  if (!/^[0-9a-f]{7,40}$/i.test(environment.commit)
    || Number.isNaN(Date.parse(environment.capturedAt))) {
    throw new Error('Browser quality evidence environment provenance is invalid.');
  }

  return environment;
}

function requireSamples(value: unknown): readonly number[] {
  if (!Array.isArray(value) || value.length === 0 || value.some((sample) => typeof sample !== 'number' || !Number.isFinite(sample))) {
    throw new Error('Browser quality evidence requires finite measured samples.');
  }

  return value;
}

function requireThresholds(value: unknown): Readonly<Record<string, number>> {
  if (!isRecord(value) || Object.keys(value).length === 0
    || Object.entries(value).some(([name, threshold]) => name.trim().length === 0 || typeof threshold !== 'number' || !Number.isFinite(threshold))) {
    throw new Error('Browser quality evidence requires finite thresholds.');
  }

  return value as Record<string, number>;
}

function assertEvidence(value: unknown, expectedKind: BrowserQualityEvidenceKind): BrowserQualityEvidence {
  if (!isRecord(value)) {
    throw new Error('Browser quality evidence must be an object.');
  }

  if (value.kind !== expectedKind) {
    throw new Error(`Browser quality evidence requires kind ${expectedKind}.`);
  }

  const aggregation = requireString(value.aggregation, 'aggregation');
  const artifactPath = requireString(value.artifactPath, 'artifactPath');
  if (value.verdict !== 'pass' && value.verdict !== 'fail') {
    throw new Error('Browser quality evidence requires a pass or fail verdict.');
  }

  return {
    kind: expectedKind,
    route: requireKnownRoute(value.route),
    environment: requireEnvironment(value.environment),
    samples: requireSamples(value.samples),
    aggregation,
    thresholds: requireThresholds(value.thresholds),
    verdict: value.verdict,
    artifactPath,
  };
}

export function assertRouteRunEvidence(value: unknown): BrowserQualityEvidence {
  return assertEvidence(value, 'route-run');
}

export function assertPerformanceEvidence(value: unknown): BrowserQualityEvidence {
  return assertEvidence(value, 'performance');
}

export function assertAccessibilityEvidence(value: unknown): BrowserQualityEvidence {
  return assertEvidence(value, 'accessibility');
}
