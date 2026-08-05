import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { afterEach, describe, expect, it } from 'vitest';

type QualityEnvironment = {
  node: string;
  npm: string;
  vite: string;
  platform: string;
  architecture: string;
  commit: string;
  capturedAt: string;
};

type QualityBaseline = {
  schemaVersion: 1;
  environment: QualityEnvironment;
  phase41Comparison: Record<string, { rawBytes: number; gzipBytes: number }>;
  chunks: Array<{ logicalPath: string; rawBytes: number; gzipBytes: number }>;
};

type BaselineCollector = Readonly<{
  collectChunkMeasurements(manifest: Record<string, { file: string; name?: string; src?: string }>, outputDir: string): QualityBaseline['chunks'];
  collectQualityBaseline(options: {
    environment: QualityEnvironment;
    manifestPath: string;
    outputDir: string;
  }): QualityBaseline;
  writeQualityBaseline(baseline: QualityBaseline, baselinePath: string): void;
  validateQualityBaseline(baseline: unknown): void;
}>;

const require = createRequire(import.meta.url);
const collector = require('../collect-quality-baseline.cjs') as BaselineCollector;

function environment(node = '24.13.0'): QualityEnvironment {
  return {
    node,
    npm: '11.6.2',
    vite: '7.3.6',
    platform: 'darwin',
    architecture: 'arm64',
    commit: '0123456789abcdef',
    capturedAt: '2026-08-04T20:00:00.000Z',
  };
}

function writeFixture(root: string, relativePath: string, contents: string): void {
  const target = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, contents);
}

describe('Node 24 renderer quality baseline collector', () => {
  const roots: string[] = [];

  afterEach(() => {
    for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
  });

  it('measures every manifest chunk by stable logical path without generated hash identity', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fmcl-quality-baseline-'));
    roots.push(root);
    const outputDir = path.join(root, 'dist');
    writeFixture(root, 'dist/assets/index-A1B2C3.js', 'console.log("index")');
    writeFixture(root, 'dist/assets/ModpackRouter-D4E5F6.js', 'console.log("router")');

    const chunks = collector.collectChunkMeasurements({
      'src/features/modpacks/ModpackRouter.tsx': {
        file: 'assets/ModpackRouter-D4E5F6.js',
        name: 'ModpackRouter',
        src: 'src/features/modpacks/ModpackRouter.tsx',
      },
      'src/main.tsx': {
        file: 'assets/index-A1B2C3.js',
        name: 'index',
        src: 'src/main.tsx',
      },
    }, outputDir);

    expect(chunks.map((chunk) => chunk.logicalPath)).toEqual([
      'src/features/modpacks/ModpackRouter.tsx',
      'src/main.tsx',
    ]);
    expect(chunks.every((chunk) => chunk.rawBytes > 0 && chunk.gzipBytes > 0)).toBe(true);
    expect(JSON.stringify(chunks)).not.toContain('A1B2C3');
    expect(JSON.stringify(chunks)).not.toContain('D4E5F6');
  });

  it('fails before writing for an absent manifest, non-Node-24 environment, or malformed baseline', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fmcl-quality-baseline-'));
    roots.push(root);
    const baselinePath = path.join(root, 'quality', 'baselines', 'node24-vite.json');

    expect(() => collector.collectQualityBaseline({
      environment: environment(),
      manifestPath: path.join(root, 'missing-manifest.json'),
      outputDir: path.join(root, 'dist'),
    })).toThrow('Vite manifest is missing');

    expect(() => collector.collectQualityBaseline({
      environment: environment('20.19.0'),
      manifestPath: path.join(root, 'missing-manifest.json'),
      outputDir: path.join(root, 'dist'),
    })).toThrow('Node.js 24.x is required');

    expect(() => collector.writeQualityBaseline({
      schemaVersion: 1,
      environment: environment(),
      phase41Comparison: {
        index: { rawBytes: 1, gzipBytes: 1 },
        modpackRouter: { rawBytes: 1, gzipBytes: 1 },
      },
      chunks: [{ logicalPath: 'src/main.tsx', rawBytes: 1, gzipBytes: 1, hash: 'forbidden' }],
    } as unknown as QualityBaseline, baselinePath)).toThrow('unexpected field');
    expect(fs.existsSync(baselinePath)).toBe(false);
  });
});
