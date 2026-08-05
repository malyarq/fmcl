import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { afterEach, describe, expect, it } from 'vitest';

type StageResult = { name: string; command: string; exitCode: number; status: 'passed' | 'failed' | 'skipped'; durationMs: number };
type QualityContract = Readonly<{
  createQualityPlan(options: { profile: 'pr' | 'release'; inputs?: Record<string, string> }): { stages: Array<{ name: string; command: string; args: string[] }> };
  runQualityPlan(options: { plan: { stages: Array<{ name: string; command: string; args: string[] }> }; run: (command: string, args: string[]) => { exitCode: number }; outputFile: string; now?: () => number }): { status: string; stages: StageResult[] };
  validatePackageScripts(scripts: Record<string, string>): string[];
  resolveRuntimeCommand(command: string, args: string[], runtime: { node: string; npmCli: string }): { command: string; args: string[] };
}>;

const require = createRequire(import.meta.url);
const contract = require('../quality-contract.cjs') as QualityContract;
const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

describe('shared source quality contract', () => {
  it('expands the PR profile in the declared blocking order and maps bundle to its atomic entrypoint', () => {
    const plan = contract.createQualityPlan({ profile: 'pr' });

    expect(plan.stages.map((stage) => stage.name)).toEqual([
      'node-preflight', 'unit', 'lint', 'typecheck', 'docs', 'contracts', 'ipc', 'legacy-import', 'architecture', 'dependency-graph', 'complexity', 'audit', 'fault-matrix', 'bundle', 'performance', 'accessibility',
    ]);
    expect(plan.stages.find((stage) => stage.name === 'bundle')).toMatchObject({ command: 'npm', args: ['run', 'quality:bundle'] });
  });

  it('adds only actual artifact inputs in release mode and rejects absent release evidence inputs', () => {
    expect(() => contract.createQualityPlan({ profile: 'release' })).toThrow(/release profile requires/i);
    const plan = contract.createQualityPlan({ profile: 'release', inputs: { releaseDir: 'release/0.8.0-rc.1', version: '0.8.0-rc.1', tag: 'v0.8.0-rc.1', commit: 'a'.repeat(40), report: 'release-evidence/prepush.json' } });
    expect(plan.stages.slice(-2).map((stage) => stage.name)).toEqual(['package-smoke', 'release-evidence']);
    expect(plan.stages.at(-2)).toMatchObject({ args: ['run', 'smoke:package', '--', '--release-dir', 'release/0.8.0-rc.1', '--version', '0.8.0-rc.1'] });
  });

  it('records machine-readable results and stops after the first failed high-severity gate', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fmcl-quality-contract-'));
    roots.push(root);
    const result = contract.runQualityPlan({
      plan: { stages: [
        { name: 'node-preflight', command: 'node', args: ['scripts/assert-node24.cjs'] },
        { name: 'dependency-graph', command: 'node', args: ['scripts/check-dependency-graph.cjs'] },
        { name: 'bundle', command: 'npm', args: ['run', 'quality:bundle'] },
      ] },
      run: (_command, args) => ({ exitCode: args[0] === 'scripts/check-dependency-graph.cjs' ? 1 : 0 }),
      outputFile: path.join(root, 'quality-result.json'),
      now: (() => { let tick = 0; return () => ++tick; })(),
    });

    expect(result).toMatchObject({ status: 'failed' });
    expect(result.stages).toEqual([
      expect.objectContaining({ name: 'node-preflight', status: 'passed' }),
      expect.objectContaining({ name: 'dependency-graph', status: 'failed' }),
    ]);
    expect(JSON.parse(fs.readFileSync(path.join(root, 'quality-result.json'), 'utf8'))).toMatchObject({ status: 'failed' });
  });

  it('fails closed for unknown stages, missing commands, and circular package scripts', () => {
    expect(() => contract.runQualityPlan({ plan: { stages: [{ name: 'unknown', command: 'node', args: [] }] }, run: () => ({ exitCode: 0 }), outputFile: path.join(os.tmpdir(), 'unused.json') })).toThrow(/unknown stage/i);
    expect(() => contract.runQualityPlan({ plan: { stages: [{ name: 'unit', command: '', args: [] }] }, run: () => ({ exitCode: 0 }), outputFile: path.join(os.tmpdir(), 'unused.json') })).toThrow(/missing command/i);
    expect(contract.validatePackageScripts({ verify: 'npm run quality:check', 'quality:check': 'node scripts/quality-contract.cjs', loop: 'npm run loop' })).toEqual(expect.arrayContaining([expect.stringMatching(/verify.*quality:check/i), expect.stringMatching(/loop/i)]));
  });

  it('keeps every node, npm, and npx child on the invoking Node 24 runtime', () => {
    const runtime = { node: '/node24/bin/node', npmCli: '/node24/lib/node_modules/npm/bin/npm-cli.js' };
    expect(contract.resolveRuntimeCommand('node', ['scripts/check-complexity.cjs'], runtime)).toEqual({ command: runtime.node, args: ['scripts/check-complexity.cjs'] });
    expect(contract.resolveRuntimeCommand('npm', ['run', 'lint'], runtime)).toEqual({ command: runtime.node, args: [runtime.npmCli, 'run', 'lint'] });
    expect(contract.resolveRuntimeCommand('npx', ['tsc', '--noEmit'], runtime)).toEqual({ command: runtime.node, args: [runtime.npmCli, 'exec', '--', 'tsc', '--noEmit'] });
  });
});
