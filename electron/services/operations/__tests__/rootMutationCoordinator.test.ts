import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InstanceApplication } from '../../../domains/instances/instanceApplication';
import type { InstanceEditableConfig, LauncherRoot } from '../../../domains/instances/instanceTypes';
import { JsonControlPlaneStore } from '../../../infrastructure/instances/jsonControlPlaneStore';
import { OperationRunner } from '../operationRunner';
import { RootMutationLock } from '../rootMutationLock';

const config: InstanceEditableConfig = {
  runtime: { minecraftVersion: '1.21.1', modLoader: { type: 'fabric', version: '0.16.0' } },
  memory: { maxMb: 4096 },
};

type Fixture = {
  rootPath: string;
  root: LauncherRoot;
  store: JsonControlPlaneStore;
};

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value));
}

function createFixture(withLegacy = true): Fixture {
  const rootPath = fs.mkdtempSync(path.join(os.tmpdir(), 'burrow-root-mutation-coordinator-'));
  const root = {} as LauncherRoot;
  if (withLegacy) {
    writeJson(path.join(rootPath, 'modpacks.json'), {
      _fmclSchemaVersion: 1,
      selectedModpack: 'pack-one',
      modpacks: { 'pack-one': { name: 'Pack One' } },
    });
    writeJson(path.join(rootPath, 'modpacks-metadata.json'), {
      _fmclSchemaVersion: 1,
      selectedModpack: 'pack-one',
      modpacks: {
        'pack-one': {
          id: 'pack-one', name: 'Pack One', source: 'local', minecraftVersion: '1.21.1',
          createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z',
        },
      },
    });
    writeJson(path.join(rootPath, 'modpacks', 'pack-one', 'modpack.json'), {
      _fmclSchemaVersion: 1,
      id: 'pack-one', name: 'Pack One', runtime: { minecraft: '1.21.1' }, memory: { maxMb: 4096 }, vmOptions: [],
      createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z',
    });
  }
  return {
    rootPath,
    root,
    store: new JsonControlPlaneStore((candidate) => {
      if (candidate !== root) throw new Error('unexpected launcher root');
      return rootPath;
    }),
  };
}

function coordinatorFor(fixture: Fixture) {
  const application = new InstanceApplication({
    controlPlane: fixture.store,
    clock: { now: () => '2026-08-04T00:00:00.000Z' },
    ids: { next: () => 'created-pack' },
  });
  return {
    read: () => application.read(fixture.root),
    prepare: () => fixture.store.prepareFromLegacy(fixture.root),
    execute: (command: unknown) => application.execute(fixture.root, command),
  };
}

describe('OperationRunner root mutation coordinator', () => {
  const roots: string[] = [];

  afterEach(() => {
    vi.restoreAllMocks();
    for (const rootPath of roots.splice(0)) fs.rmSync(rootPath, { recursive: true, force: true });
  });

  it('serializes two first-use contenders, rereads under the existing root lock, and migrates once', async () => {
    const fixture = createFixture();
    roots.push(fixture.rootPath);
    const lock = new RootMutationLock();
    const lockRun = vi.spyOn(lock, 'run');
    const reread = vi.spyOn(fixture.store, 'read');
    const prepare = vi.spyOn(fixture.store, 'prepareFromLegacy');
    const runner = new OperationRunner([], {
      rootMutationLock: lock,
      rootMutationCoordinator: { forRoot: () => coordinatorFor(fixture) },
    });

    const [first, second] = await Promise.all([
      runner.prepareControlPlane(fixture.rootPath),
      runner.prepareControlPlane(fixture.rootPath),
    ]);

    expect(first).toMatchObject({ status: 'ready', source: 'legacy-migration' });
    expect(second).toMatchObject({ status: 'ready', source: 'canonical' });
    expect(lockRun).toHaveBeenCalledTimes(2);
    expect(reread.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(prepare).toHaveBeenCalledTimes(1);
  });

  it('keeps ordinary reads write-free and only prepares legacy state for explicit create', async () => {
    const fixture = createFixture(false);
    roots.push(fixture.rootPath);
    const prepare = vi.spyOn(fixture.store, 'prepareFromLegacy');
    const runner = new OperationRunner([], {
      rootMutationCoordinator: { forRoot: () => coordinatorFor(fixture) },
    });

    await expect(runner.readControlPlane(fixture.rootPath)).resolves.toEqual({ status: 'uninitialized' });
    expect(fs.existsSync(path.join(fixture.rootPath, 'instance-control-plane.json'))).toBe(false);
    expect(prepare).not.toHaveBeenCalled();

    await expect(runner.commitControlPlane(fixture.rootPath, {
      version: 1,
      type: 'create',
      name: 'Created Pack',
      source: { source: 'local' },
      config,
    })).resolves.toMatchObject({ status: 'committed', snapshot: { selectedId: 'created-pack' } });
    expect(prepare).toHaveBeenCalledTimes(1);
    expect(fs.existsSync(path.join(fixture.rootPath, 'instance-control-plane.json'))).toBe(true);
  });

  it('lets an operation adapter commit through its already-held runner scope without recursively locking', async () => {
    const fixture = createFixture();
    roots.push(fixture.rootPath);
    const lock = new RootMutationLock();
    const lockRun = vi.spyOn(lock, 'run');
    const runner = new OperationRunner([{
      kind: 'duplicate',
      run: async (context) => {
        await context.commitControlPlane({ version: 1, type: 'rename', id: 'pack-one', name: 'Renamed Pack' });
        return { status: 'succeeded', instanceId: 'pack-one' };
      },
    }], {
      rootMutationLock: lock,
      rootMutationCoordinator: { forRoot: () => coordinatorFor(fixture) },
    });

    await expect(runner.prepareControlPlane(fixture.rootPath)).resolves.toMatchObject({ status: 'ready' });
    lockRun.mockClear();

    const started = runner.start({ kind: 'duplicate', rootPath: fixture.rootPath, sourceId: 'pack-one' });
    await expect(runner.waitFor(started.id)).resolves.toMatchObject({ status: 'succeeded' });

    expect(lockRun).toHaveBeenCalledTimes(1);
    await expect(runner.readControlPlane(fixture.rootPath)).resolves.toMatchObject({
      status: 'ready', snapshot: { records: [{ id: 'pack-one', name: 'Renamed Pack' }] },
    });
  });
});
