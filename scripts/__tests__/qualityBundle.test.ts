import { createRequire } from 'node:module';
import packageJson from '../../package.json';
import { describe, expect, it } from 'vitest';

type QualityBundle = Readonly<{
  createQualityBundlePlan(options: { cwd: string; startedAt: Date; getCommit: (cwd: string) => string }): {
    preflight: { command: string; args: string[] };
    cleanOutput: string;
    build: { command: string; args: string[] };
    manifestPath: string;
    check: { command: string; args: string[] };
  };
}>;

const require = createRequire(import.meta.url);
const qualityBundle = require('../quality-bundle.cjs') as QualityBundle;

describe('atomic quality bundle entrypoint', () => {
  it('maps quality:bundle directly to the atomic entrypoint', () => {
    expect(packageJson.scripts['quality:bundle']).toBe('node scripts/quality-bundle.cjs');
  });

  it('runs the Node 24 preflight, only cleans renderer dist, builds, manifests, then checks', () => {
    const plan = qualityBundle.createQualityBundlePlan({
      cwd: process.cwd(),
      startedAt: new Date('2026-08-04T22:00:00.000Z'),
      getCommit: () => 'a'.repeat(40),
    });

    expect(plan.preflight).toMatchObject({ args: ['scripts/assert-node24.cjs'] });
    expect(plan.cleanOutput).toBe('dist');
    expect(plan.build.args).toContain('--manifest');
    expect(plan.manifestPath).toBe('dist/burrow-bundle-manifest.json');
    expect(plan.check.args).toEqual(expect.arrayContaining(['scripts/check-bundle.cjs', '--manifest', 'dist/burrow-bundle-manifest.json']));
  });
});
