import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { afterEach, describe, expect, it } from 'vitest';

type ComplexityMetric = Readonly<{
  path: string;
  category: string;
  loc: number;
  maxFunctionComplexity: number;
}>;

type ComplexityChecker = Readonly<{
  collectComplexityInventory(projectRoot: string): ComplexityMetric[];
  collectComplexityViolations(projectRoot: string, ratchet: unknown): string[];
  createRatchet(projectRoot: string): {
    defaults: Record<string, { maxLoc: number; maxFunctionComplexity: number }>;
    exceptions: Record<string, { maxLoc: number; maxFunctionComplexity: number }>;
  };
}>;

const require = createRequire(import.meta.url);
const checker = require('../check-complexity.cjs') as ComplexityChecker;

function writeFixture(root: string, relativePath: string, source: string): void {
  const target = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, source);
}

function createFixture(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'fmcl-complexity-'));
}

function ratchet(exceptions: Record<string, { maxLoc: number; maxFunctionComplexity: number }> = {}): unknown {
  return {
    schemaVersion: 2,
    defaults: {
      renderer: { maxLoc: 4, maxFunctionComplexity: 1 },
      shared: { maxLoc: 4, maxFunctionComplexity: 1 },
      'electron-app': { maxLoc: 4, maxFunctionComplexity: 1 },
      'electron-domain': { maxLoc: 4, maxFunctionComplexity: 1 },
      'electron-infrastructure': { maxLoc: 4, maxFunctionComplexity: 1 },
      'electron-ipc': { maxLoc: 4, maxFunctionComplexity: 1 },
      'electron-preload': { maxLoc: 4, maxFunctionComplexity: 1 },
      'electron-service': { maxLoc: 4, maxFunctionComplexity: 1 },
    },
    exceptions,
  };
}

describe('complexity ratchet', () => {
  const roots: string[] = [];

  afterEach(() => {
    for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
  });

  it('returns a path-sorted production inventory with non-comment LOC and branch complexity', () => {
    const root = createFixture();
    roots.push(root);
    writeFixture(root, 'src/features/zeta.ts', '// comment\nexport function zeta(value: boolean) {\n  return value ? 1 : 0;\n}\n');
    writeFixture(root, 'shared/contracts/alpha.ts', 'export type Alpha = { id: string };\n');
    writeFixture(root, 'src/features/__tests__/ignored.test.ts', 'export const ignored = true;\n');

    expect(checker.collectComplexityInventory(root)).toEqual([
      { path: 'shared/contracts/alpha.ts', category: 'shared', loc: 1, maxFunctionComplexity: 0 },
      { path: 'src/features/zeta.ts', category: 'renderer', loc: 3, maxFunctionComplexity: 2 },
    ]);
  });

  it('rounds generated limits so ordinary edits do not require line-by-line baseline churn', () => {
    const root = createFixture();
    roots.push(root);
    writeFixture(root, 'src/features/hot.ts', [
      'export function hot(value: boolean) {',
      '  if (value) return 1;',
      '  return 0;',
      '}',
    ].join('\n'));

    const generated = checker.createRatchet(root);

    expect(generated.defaults.renderer).toEqual({ maxLoc: 25, maxFunctionComplexity: 5 });
    expect(generated.exceptions).toEqual({});
  });

  it('permits an existing hotspot only at its explicit path-specific allowance', () => {
    const root = createFixture();
    roots.push(root);
    writeFixture(root, 'src/features/hot.ts', 'export function hot(value: boolean) {\n  if (value) return 1;\n  return 0;\n}\n');

    expect(checker.collectComplexityViolations(root, ratchet({
      'src/features/hot.ts': { maxLoc: 5, maxFunctionComplexity: 2 },
    }))).toEqual([]);

    writeFixture(root, 'src/features/hot.ts', 'export function hot(value: boolean) {\n  if (value) return 1;\n  if (!value) return 0;\n  return 2;\n}\n');
    expect(checker.collectComplexityViolations(root, ratchet({
      'src/features/hot.ts': { maxLoc: 5, maxFunctionComplexity: 2 },
    }))).toEqual([
      'src/features/hot.ts maxFunctionComplexity 3 exceeds path ratchet 2',
    ]);
  });

  it('rejects renamed and unknown over-budget modules with the required path entry', () => {
    const root = createFixture();
    roots.push(root);
    const source = 'export function moved(value: boolean) {\n  if (value) return 1;\n  return 0;\n}\n';
    writeFixture(root, 'src/features/renamed.ts', source);

    expect(checker.collectComplexityViolations(root, ratchet({
      'src/features/hot.ts': { maxLoc: 4, maxFunctionComplexity: 2 },
    }))).toEqual([
      'src/features/renamed.ts maxFunctionComplexity 2 exceeds renderer default 1; add path ratchet entry',
    ]);
  });
});
