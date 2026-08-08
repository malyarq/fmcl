import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { afterEach, describe, expect, it } from 'vitest';

type Chunk = { logicalPath: string; rawBytes: number; gzipBytes: number };
type Environment = {
  node: string;
  npm: string;
  vite: string;
  platform: string;
  architecture: string;
  commit: string;
  capturedAt: string;
};

type Baseline = { environment: Environment; chunks: Chunk[]; schemaVersion: 1 };

type BundleChecker = Readonly<{
  checkBundle(options: {
    baseline: Baseline;
    budget: { schemaVersion: 1; bundle: { environment: Omit<Environment, 'commit' | 'capturedAt'>; tolerancePercent: number; chunks: Array<Chunk & { rawLimit: number; gzipLimit: number }> }; runtime: Record<string, unknown> };
    manifest: { environment: Environment; chunks: Chunk[]; startedAt: string; completedAt: string };
    outputDir: string;
    now?: () => Date;
  }): { failures: string[]; ignoredEvidence: unknown };
  validateBundleManifest(value: unknown): void;
}>;

const require = createRequire(import.meta.url);
const checker = require('../check-bundle.cjs') as BundleChecker;

function environment(overrides: Partial<Environment> = {}): Environment {
  return {
    node: '24.13.0',
    npm: '11.6.2',
    vite: '7.3.6',
    platform: 'darwin',
    architecture: 'arm64',
    commit: 'a'.repeat(40),
    capturedAt: '2026-08-04T22:00:00.000Z',
    ...overrides,
  };
}

function fixture(overrides: Partial<{ baseline: Baseline; budget: { schemaVersion: 1; bundle: { environment: Omit<Environment, 'commit' | 'capturedAt'>; tolerancePercent: number; chunks: Array<Chunk & { rawLimit: number; gzipLimit: number }> }; runtime: Record<string, unknown> }; manifest: { environment: Environment; chunks: Chunk[]; startedAt: string; completedAt: string } }> = {}) {
  const chunk = { logicalPath: 'index.html', rawBytes: 100, gzipBytes: 50 };
  return {
    baseline: {
      schemaVersion: 1,
      environment: environment(),
      chunks: [chunk],
    },
    budget: {
      schemaVersion: 1,
      bundle: {
        environment: (({ node, npm, vite, platform, architecture }) => ({ node, npm, vite, platform, architecture }))(environment()),
        tolerancePercent: 2,
        chunks: [{ ...chunk, rawLimit: 102, gzipLimit: 51 }],
      },
      runtime: {},
    },
    manifest: {
      environment: environment(),
      chunks: [chunk],
      startedAt: '2026-08-04T22:00:00.000Z',
      completedAt: '2026-08-04T22:00:01.000Z',
    },
    ...overrides,
  };
}

describe('renderer bundle budget checker', () => {
  const roots: string[] = [];

  afterEach(() => {
    for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
  });

  it.each([
    ['environment mismatch', { manifest: { ...fixture().manifest, environment: environment({ vite: '7.4.0' }) } }, /environment/i],
    ['raw-only breach', { manifest: { ...fixture().manifest, chunks: [{ logicalPath: 'index.html', rawBytes: 103, gzipBytes: 51 }] } }, /raw/i],
    ['gzip-only breach', { manifest: { ...fixture().manifest, chunks: [{ logicalPath: 'index.html', rawBytes: 102, gzipBytes: 52 }] } }, /gzip/i],
    ['unknown chunk', { manifest: { ...fixture().manifest, chunks: [{ logicalPath: 'other.tsx', rawBytes: 1, gzipBytes: 1 }] } }, /unknown|dropped/i],
  ])('reports a sorted fail-closed result for %s', (_case, overrides, expected) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'burrow-check-bundle-'));
    roots.push(root);
    fs.mkdirSync(root, { recursive: true });
    const result = checker.checkBundle({ ...fixture(overrides), outputDir: root, expectedCommit: 'a'.repeat(40), now: () => new Date('2026-08-04T22:00:02.000Z') });
    expect(result.failures.join('\n')).toMatch(expected);
    expect(result.failures).toEqual([...result.failures].sort());
  });

  it('accepts exact raw and gzip thresholds and records ignored evidence', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'burrow-check-bundle-'));
    roots.push(root);
    fs.writeFileSync(path.join(root, 'asset.js'), 'current build');
    const result = checker.checkBundle({
      ...fixture({ manifest: { ...fixture().manifest, chunks: [{ logicalPath: 'index.html', rawBytes: 102, gzipBytes: 51 }] } }),
      outputDir: root,
      expectedCommit: 'a'.repeat(40),
      now: () => new Date('2026-08-04T22:00:02.000Z'),
    });
    expect(result.failures).toEqual([]);
    expect(result.ignoredEvidence).toMatchObject({ verdict: 'pass' });
  });

  it('accepts a different recorded host when the pinned build toolchain and bytes match', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'burrow-check-bundle-'));
    roots.push(root);
    fs.writeFileSync(path.join(root, 'asset.js'), 'current build');
    const result = checker.checkBundle({
      ...fixture({ manifest: { ...fixture().manifest, environment: environment({ platform: 'linux', architecture: 'x64' }) } }),
      outputDir: root,
      expectedCommit: 'a'.repeat(40),
      now: () => new Date('2026-08-04T22:00:02.000Z'),
    });

    expect(result.failures).toEqual([]);
    expect(result.ignoredEvidence).toMatchObject({
      environment: expect.objectContaining({ platform: 'linux', architecture: 'x64' }),
      verdict: 'pass',
    });
  });

  it.each([
    ['missing output', (root: string) => fs.rmSync(root, { recursive: true, force: true }), /output/i],
    ['stale output', (root: string) => fs.utimesSync(root, new Date('2026-08-04T21:00:00.000Z'), new Date('2026-08-04T21:00:00.000Z')), /stale/i],
    ['different commit', (_root: string) => undefined, /commit/i],
  ])('rejects %s provenance', (_case, prepare, expected) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'burrow-check-bundle-'));
    roots.push(root);
    const values = fixture();
    if (_case === 'different commit') values.manifest.environment = environment({ commit: 'b'.repeat(40) });
    prepare(root);
    const result = checker.checkBundle({ ...values, outputDir: root, expectedCommit: 'a'.repeat(40), now: () => new Date('2026-08-04T22:00:02.000Z') });
    expect(result.failures.join('\n')).toMatch(expected);
  });

  it('rejects manifests with unsupported provenance fields', () => {
    expect(() => checker.validateBundleManifest({ ...fixture().manifest, hash: 'forbidden' })).toThrow(/unexpected field/i);
  });
});
