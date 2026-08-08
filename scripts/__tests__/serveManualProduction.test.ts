import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { afterEach, describe, expect, it } from 'vitest';
import {
  PERFORMANCE_PRODUCTION_PROJECT,
  PRODUCTION_PREVIEW_URL,
} from '../../playwright.config';
import viteConfig from '../../vite.config';

type ProductionPreviewServer = Readonly<{
  createProductionPreviewPlan(options: {
    cwd: string;
    port: number;
    processInfo: NodeJS.Process;
    environment: NodeJS.ProcessEnv;
    getCommit: (cwd: string) => string;
  }): {
    build: { command: string; args: string[]; env: NodeJS.ProcessEnv };
    preview: { command: string; args: string[]; env: NodeJS.ProcessEnv };
    proof: { commit: string; mode: 'production'; profiling: true };
  };
  writeProductionPreviewProof(outputDir: string, proof: { commit: string; mode: 'production'; profiling: true }): string;
  verifyProductionPreviewOutput(options: {
    outputDir: string;
    expectedCommit: string;
  }): void;
}>;

const require = createRequire(import.meta.url);
const server = require('../serve-manual-production.cjs') as ProductionPreviewServer;

function processFixture(node: string): NodeJS.Process {
  return {
    version: `v${node}`,
    versions: { node, npm: '11.6.2' },
    platform: 'darwin',
    arch: 'arm64',
    execPath: '/node24/bin/node',
  } as NodeJS.Process;
}

describe('production manual preview', () => {
  const roots: string[] = [];

  afterEach(() => {
    for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
  });

  it('pins the performance project to Chromium, one worker, fixed viewports, and the dedicated production preview', () => {
    expect(PERFORMANCE_PRODUCTION_PROJECT).toMatchObject({
      name: 'performance-production',
      use: {
        browserName: 'chromium',
        baseURL: PRODUCTION_PREVIEW_URL,
        viewport: { width: 1280, height: 1024 },
        reducedMotion: 'reduce',
      },
    });
    expect(PERFORMANCE_PRODUCTION_PROJECT.workers).toBe(1);
    expect(PRODUCTION_PREVIEW_URL).toBe('http://127.0.0.1:4174');
  });

  it('builds manual verification as a production HTML entry instead of a source-only dev URL', () => {
    expect(viteConfig.build?.rollupOptions?.input).toEqual({
      main: path.resolve(process.cwd(), 'index.html'),
      manualVerification: path.resolve(process.cwd(), 'manual-verification.html'),
    });
  });

  it('builds and previews only a Node 24 production renderer with current-commit proof', () => {
    const plan = server.createProductionPreviewPlan({
      cwd: process.cwd(),
      port: 4174,
      processInfo: processFixture('24.13.0'),
      environment: { NODE_ENV: 'production' },
      getCommit: () => 'a'.repeat(40),
    });

    expect(plan.build).toMatchObject({
      command: '/node24/bin/node',
      args: expect.arrayContaining(['build', '--manifest']),
      env: expect.objectContaining({ NODE_ENV: 'production', BURROW_RENDERER_ONLY: '1', BURROW_MANUAL_PROFILING: '1' }),
    });
    expect(plan.preview).toMatchObject({
      command: '/node24/bin/node',
      args: expect.arrayContaining(['preview', '--host', '127.0.0.1', '--port', '4174']),
    });
    expect(plan.proof).toEqual({ commit: 'a'.repeat(40), mode: 'production', profiling: true });
  });

  it('rejects development mode, the wrong Node version, and incomplete production output before preview', () => {
    const options = {
      cwd: '/repo',
      port: 4174,
      processInfo: processFixture('24.13.0'),
      environment: { NODE_ENV: 'development' },
      getCommit: () => 'a'.repeat(40),
    };

    expect(() => server.createProductionPreviewPlan(options)).toThrow(/NODE_ENV=production/i);
    expect(() => server.createProductionPreviewPlan({ ...options, environment: { NODE_ENV: 'production' }, processInfo: processFixture('20.19.0') })).toThrow(/Node.js 24/i);

    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'burrow-production-preview-'));
    roots.push(root);
    const outputDir = path.join(root, 'dist');
    fs.mkdirSync(path.join(outputDir, '.vite'), { recursive: true });
    fs.writeFileSync(path.join(outputDir, 'manual-verification.html'), '<div id="root"></div>');
    fs.writeFileSync(path.join(outputDir, '.vite', 'manifest.json'), '{}');

    expect(() => server.verifyProductionPreviewOutput({ outputDir, expectedCommit: 'a'.repeat(40) })).toThrow(/proof/i);
    server.writeProductionPreviewProof(outputDir, { commit: 'a'.repeat(40), mode: 'production', profiling: true });
    expect(() => server.verifyProductionPreviewOutput({ outputDir, expectedCommit: 'a'.repeat(40) })).not.toThrow();
    expect(() => server.verifyProductionPreviewOutput({ outputDir, expectedCommit: 'b'.repeat(40) })).toThrow(/commit/i);
  });
});
