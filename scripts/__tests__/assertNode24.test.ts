import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

type EnvironmentCollector = Readonly<{
  collectQualityEnvironment(options?: {
    processInfo?: NodeJS.Process;
    cwd?: string;
    now?: () => Date;
    getCommit?: (cwd: string) => string;
  }): {
    node: string;
    npm: string;
    vite: string;
    platform: string;
    architecture: string;
    commit: string;
    capturedAt: string;
  };
  runPreflight(options?: {
    processInfo?: NodeJS.Process;
    cwd?: string;
    now?: () => Date;
    getCommit?: (cwd: string) => string;
  }): { exitCode: number; output?: string; error?: string };
}>;

const require = createRequire(import.meta.url);
const preflight = require('../assert-node24.cjs') as EnvironmentCollector;

function processFixture(node: string): NodeJS.Process {
  return {
    version: `v${node}`,
    versions: { node, npm: '11.6.2' },
    platform: 'darwin',
    arch: 'arm64',
  } as NodeJS.Process;
}

describe('Node 24 quality-environment preflight', () => {
  it('collects the complete reproducible environment under Node 24', () => {
    expect(preflight.collectQualityEnvironment({
      processInfo: processFixture('24.13.0'),
      cwd: process.cwd(),
      now: () => new Date('2026-08-04T20:00:00.000Z'),
      getCommit: () => '0123456789abcdef',
    })).toEqual({
      node: '24.13.0',
      npm: '11.6.2',
      vite: '7.3.6',
      platform: 'darwin',
      architecture: 'arm64',
      commit: '0123456789abcdef',
      capturedAt: '2026-08-04T20:00:00.000Z',
    });
  });

  it.each(['20.19.0', '25.0.0'])('rejects Node %s with the required major version', (node) => {
    const result = preflight.runPreflight({ processInfo: processFixture(node), cwd: process.cwd() });

    expect(result.exitCode).not.toBe(0);
    expect(result.error).toContain('Node.js 24.x is required');
  });
});
