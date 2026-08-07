import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { afterEach, describe, expect, it } from 'vitest';

type ArchitectureChecker = Readonly<{
  collectArchitectureViolations(projectRoot: string): string[];
}>;

const require = createRequire(import.meta.url);
const checker = require('../check-architecture.cjs') as ArchitectureChecker;

function writeFixture(root: string, relativePath: string, source: string): void {
  const target = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, source);
}

function createFixture(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fmcl-architecture-'));
  writeFixture(root, 'shared/contracts/ipcChannels.ts', 'export const channels = []\n');
  writeFixture(root, 'electron/preload.ts', "contextBridge.exposeInMainWorld('api', {})\n");
  return root;
}

describe('architecture ownership guard', () => {
  const roots: string[] = [];

  afterEach(() => {
    for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
  });

  it('reports removed ownership, hidden construction, native domain imports and renderer path authority deterministically', () => {
    const root = createFixture();
    roots.push(root);
    for (const removedPath of [
      'electron/services/instances/instanceService.ts',
      'electron/services/instances/indexStore.ts',
      'electron/services/instances/configStore.ts',
      'electron/services/modpacks/modpackService.ts',
      'electron/services/modpacks/storage.ts',
    ]) writeFixture(root, removedPath, 'export const legacy = true\n');
    writeFixture(root, 'electron/services/directWrite.ts', "fs.writeFileSync(target, 'modpacks.json')\n");
    writeFixture(root, 'electron/services/hidden.ts', 'const application = new InstanceApplication({})\n');
    writeFixture(root, 'electron/domains/instances/unsafe.ts', "import fs from 'node:fs'\n");
    writeFixture(root, 'shared/contracts/legacy.ts', "import type { ModpacksAPI } from './modpacks'\n");
    writeFixture(root, 'src/features/legacy.ts', "import value from '../features/launch/hooks/useLaunchState'\nconst instancePath = value\n");

    expect(checker.collectArchitectureViolations(root)).toEqual([
      'electron/domains/instances/unsafe.ts:1 imports native runtime into the instance domain',
      'electron/services/directWrite.ts:1 writes control-plane files outside JsonControlPlaneStore',
      'electron/services/hidden.ts:1 constructs InstanceApplication outside the composition root',
      'electron/services/instances/configStore.ts:1 restores removed legacy owner',
      'electron/services/instances/indexStore.ts:1 restores removed legacy owner',
      'electron/services/instances/instanceService.ts:1 restores removed legacy owner',
      'electron/services/modpacks/modpackService.ts:1 restores removed legacy owner',
      'electron/services/modpacks/storage.ts:1 restores removed legacy owner',
      'shared/contracts/legacy.ts:1 imports removed launch or mixed-transport code',
      'src/features/legacy.ts:1 imports removed launch or mixed-transport code',
      'src/features/legacy.ts:2 restores renderer filesystem authority via instancePath',
    ]);
  });

  it('allows composition-owned construction, canonical domain imports and opaque renderer IDs', () => {
    const root = createFixture();
    roots.push(root);
    writeFixture(
      root,
      'electron/app/compositionRoot.ts',
      'new JsonControlPlaneStore(resolveRoot)\nnew InstanceApplication(deps)\nnew OperationRunner(adapters)\n',
    );
    writeFixture(root, 'electron/domains/instances/model.ts', "import type { InstanceId } from './instanceTypes'\n");
    writeFixture(root, 'src/features/canonical.ts', "export const instanceId = 'alpha'\n");

    expect(checker.collectArchitectureViolations(root)).toEqual([]);
  });

  it('allows the explicit full-installation harness to build an isolated temporary launcher', () => {
    const root = createFixture();
    roots.push(root);
    writeFixture(root, 'electron/app/tests/isolatedLauncher.ts', 'new LauncherManager(testDependencies)\n');
    writeFixture(root, 'electron/app/notATestHarness.ts', 'new LauncherManager(productionDependencies)\n');

    expect(checker.collectArchitectureViolations(root)).toEqual([
      'electron/app/notATestHarness.ts:1 constructs LauncherManager outside the composition root',
    ]);
  });

  it('rejects root and archive paths at every public operations boundary', () => {
    const root = createFixture();
    roots.push(root);
    writeFixture(root, 'shared/contracts/operations.ts', 'export type OperationStartRequest = { rootPath: string }\n');
    writeFixture(root, 'src/services/ipc/operationsIPC.ts', 'export const start = (filePath: string) => filePath\n');
    writeFixture(
      root,
      'src/features/operationLeak.ts',
      "import { operationsIPC } from '../services/ipc/operationsIPC'\nconst rootPath = '/private/root'\nvoid operationsIPC.start({ rootPath })\n",
    );

    expect(checker.collectArchitectureViolations(root)).toEqual([
      'shared/contracts/operations.ts:1 exposes rootPath through the public operations contract',
      'src/features/operationLeak.ts:2 passes rootPath through renderer operations',
      'src/features/operationLeak.ts:3 passes rootPath through renderer operations',
      'src/services/ipc/operationsIPC.ts:1 exposes filePath through the renderer operations wrapper',
    ]);
  });

  it('rejects native paths and legacy aliases at every public launcher boundary', () => {
    const root = createFixture();
    roots.push(root);
    writeFixture(
      root,
      'shared/contracts/launcher.ts',
      'export type LauncherLaunchOptions = { gamePath: string; javaPath?: string; modpackId?: string }\n',
    );
    writeFixture(
      root,
      'src/services/ipc/launcherIPC.ts',
      'export const launch = (instancePath: string) => instancePath\n',
    );
    writeFixture(
      root,
      'src/features/launcher/leak.ts',
      "import { launcherIPC } from '../../services/ipc/launcherIPC'\nconst javaPath = '/private/java'\nvoid launcherIPC.launch({ javaPath })\n",
    );

    expect(checker.collectArchitectureViolations(root)).toEqual([
      'shared/contracts/launcher.ts:1 exposes gamePath through the public launcher contract',
      'shared/contracts/launcher.ts:1 exposes javaPath through the public launcher contract',
      'shared/contracts/launcher.ts:1 exposes legacy modpackId through the public launcher contract',
      'src/features/launcher/leak.ts:2 passes javaPath through renderer launcher IPC',
      'src/features/launcher/leak.ts:3 passes javaPath through renderer launcher IPC',
      'src/services/ipc/launcherIPC.ts:1 exposes instancePath through the renderer launcher wrapper',
      'src/services/ipc/launcherIPC.ts:1 restores renderer filesystem authority via instancePath',
    ]);
  });
});
