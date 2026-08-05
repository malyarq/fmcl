import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { afterEach, describe, expect, it } from 'vitest';

type DependencyGraphChecker = Readonly<{
  collectDependencyGraphViolations(projectRoot: string): string[];
}>;

const require = createRequire(import.meta.url);
const checker = require('../check-dependency-graph.cjs') as DependencyGraphChecker;

function writeFixture(root: string, relativePath: string, source: string): void {
  const target = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, source);
}

function createFixture(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'fmcl-dependency-graph-'));
}

describe('dependency-direction graph guard', () => {
  const roots: string[] = [];

  afterEach(() => {
    for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
  });

  it('allows the typed renderer, shared, composition, domain and infrastructure chain', () => {
    const root = createFixture();
    roots.push(root);
    writeFixture(root, 'shared/contracts/instances.ts', 'export type InstanceId = string;\n');
    writeFixture(root, 'src/services/ipc/instancesIPC.ts', "import type { InstanceId } from '@shared/contracts/instances';\nexport const id: InstanceId = 'one';\n");
    writeFixture(root, 'electron/domains/instances/model.ts', 'export type InstanceModel = { id: string };\n');
    writeFixture(root, 'electron/infrastructure/instances/store.ts', "import type { InstanceModel } from '../../domains/instances/model';\nexport const store = {} as InstanceModel;\n");
    writeFixture(root, 'electron/app/compositionRoot.ts', "import { store } from '../infrastructure/instances/store';\nexport const composition = store;\n");
    writeFixture(root, 'electron/preload/bridges/InstancesBridge.ts', "import type { InstanceId } from '@shared/contracts/instances';\nexport const bridge = {} as { id: InstanceId };\n");

    expect(checker.collectDependencyGraphViolations(root)).toEqual([]);
  });

  it('reports every privileged renderer edge with normalized sorted path-and-line evidence', () => {
    const root = createFixture();
    roots.push(root);
    writeFixture(
      root,
      'src/features/unsafe.ts',
      "import { app } from 'electron';\nimport fs from 'node:fs';\nimport path from 'node:path';\nimport { ModrinthClient } from '@xmcl/modrinth';\nconst api = window.api;\nvoid app; void fs; void path; void ModrinthClient; void api;\n",
    );

    expect(checker.collectDependencyGraphViolations(root)).toEqual([
      'src/features/unsafe.ts:1 renderer imports privileged module electron',
      'src/features/unsafe.ts:2 renderer imports privileged module node:fs',
      'src/features/unsafe.ts:3 renderer imports privileged module node:path',
      'src/features/unsafe.ts:4 renderer imports provider SDK @xmcl/modrinth',
      'src/features/unsafe.ts:5 renderer uses generic preload global window.api',
    ]);
  });

  it('rejects dynamic and computed privileged renderer access', () => {
    const root = createFixture();
    roots.push(root);
    writeFixture(
      root,
      'src/features/dynamic-unsafe.ts',
      "const fs = await import('node:fs');\nconst electron = require('electron');\nconst provider = await import('@xmcl/modrinth');\nconst api = window['api'];\nvoid fs; void electron; void provider; void api;\n",
    );

    expect(checker.collectDependencyGraphViolations(root)).toEqual([
      'src/features/dynamic-unsafe.ts:1 renderer imports privileged module node:fs',
      'src/features/dynamic-unsafe.ts:2 renderer imports privileged module electron',
      'src/features/dynamic-unsafe.ts:3 renderer imports provider SDK @xmcl/modrinth',
      'src/features/dynamic-unsafe.ts:4 renderer uses generic preload global window.api',
    ]);
  });

  it('fails closed for non-literal imports and aliased CommonJS loaders', () => {
    const root = createFixture();
    roots.push(root);
    writeFixture(
      root,
      'src/features/hidden-loader.ts',
      "const moduleName = 'node:fs';\nconst fs = await import(moduleName);\nconst load = require;\nconst electron = load('electron');\nvoid fs; void electron;\n",
    );

    expect(checker.collectDependencyGraphViolations(root)).toEqual([
      'src/features/hidden-loader.ts:2 renderer uses non-literal dynamic import',
      'src/features/hidden-loader.ts:3 renderer aliases or dynamically uses CommonJS require',
    ]);
  });

  it('fails closed for statically computed and opaque renderer globals', () => {
    const root = createFixture();
    roots.push(root);
    writeFixture(
      root,
      'src/features/computed-global.ts',
      "const native = globalThis['re' + 'quire']('electron');\nconst api = window[`a${'pi'}`];\nconst method = 'require';\nconst opaqueLoader = globalThis[method];\nconst opaque = opaqueLoader('node:fs');\nconst preloadKey = 'api';\nconst preload = window[preloadKey];\nvoid native; void api; void opaque; void preload;\n",
    );

    expect(checker.collectDependencyGraphViolations(root)).toEqual([
      'src/features/computed-global.ts:1 renderer accesses computed global require loader',
      'src/features/computed-global.ts:2 renderer uses generic preload global window.api',
      'src/features/computed-global.ts:4 renderer accesses non-literal computed global capability',
      'src/features/computed-global.ts:7 renderer accesses non-literal computed global capability',
    ]);
  });

  it('keeps loader guards active inside the typed preload seam', () => {
    const root = createFixture();
    roots.push(root);
    writeFixture(
      root,
      'src/services/ipc/unsafeIPC.ts',
      "const method = 'require';\nconst loader = globalThis[method];\nvoid loader;\n",
    );

    expect(checker.collectDependencyGraphViolations(root)).toEqual([
      'src/services/ipc/unsafeIPC.ts:2 renderer accesses non-literal computed global capability',
    ]);
  });

  it('rejects reverse tiers, deleted owners and unresolved aliases without suppressing adjacent evidence', () => {
    const root = createFixture();
    roots.push(root);
    writeFixture(root, 'electron/app/compositionRoot.ts', 'export const composition = {};\n');
    writeFixture(root, 'electron/domains/instances/unsafe.ts', "import { composition } from '../../app/compositionRoot';\nvoid composition;\n");
    writeFixture(root, 'electron/infrastructure/instances/unsafe.ts', "import { composition } from '../../app/compositionRoot';\nvoid composition;\n");
    writeFixture(root, 'src/services/ipc/instancesIPC.ts', 'export default true;\n');
    writeFixture(root, 'shared/contracts/unsafe.ts', "import value from '../../src/services/ipc/instancesIPC';\nexport { value };\n");
    writeFixture(root, 'src/features/alias.ts', "import value from '@unknown/owner';\nexport { value };\n");
    writeFixture(root, 'electron/services/network/networkService.ts', 'export const legacy = true;\n');

    expect(checker.collectDependencyGraphViolations(root)).toEqual([
      'electron/domains/instances/unsafe.ts:1 domain imports reverse tier electron/app/compositionRoot.ts',
      'electron/infrastructure/instances/unsafe.ts:1 infrastructure imports reverse tier electron/app/compositionRoot.ts',
      'electron/services/network/networkService.ts:1 restores deleted Phase 42 owner',
      'shared/contracts/unsafe.ts:1 shared imports non-shared tier src/services/ipc/instancesIPC.ts',
      'src/features/alias.ts:1 cannot resolve import @unknown/owner',
    ]);
  });
});
