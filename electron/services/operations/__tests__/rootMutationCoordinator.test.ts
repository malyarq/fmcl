import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InstanceApplication } from '../../../domains/instances/instanceApplication';
import type { CanonicalInstanceSnapshot, InstanceEditableConfig, LauncherRoot } from '../../../domains/instances/instanceTypes';
import { JsonControlPlaneStore } from '../../../infrastructure/instances/jsonControlPlaneStore';
import { OperationRunner } from '../operationRunner';
import { RootMutationLock } from '../rootMutationLock';

const config: InstanceEditableConfig = {
  runtime: { minecraftVersion: '1.21.1', modLoader: { type: 'fabric', version: '0.16.0' } },
  memory: { maxMb: 4096 },
};

const initialSnapshot: CanonicalInstanceSnapshot = {
  selectedId: 'pack-one',
  records: [{
    id: 'pack-one',
    name: 'Pack One',
    source: {
      source: 'local',
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
    },
    config,
    summary: { minecraftVersion: '1.21.1', modLoader: { type: 'fabric', version: '0.16.0' } },
  }],
};

type Fixture = {
  rootPath: string;
  root: LauncherRoot;
  store: JsonControlPlaneStore;
  nextId: number;
};

function createFixture(): Fixture {
  const rootPath = fs.mkdtempSync(path.join(os.tmpdir(), 'burrow-root-mutation-coordinator-'));
  const root = {} as LauncherRoot;
  return {
    rootPath,
    root,
    nextId: 0,
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
    ids: { next: () => `created-pack-${fixture.nextId += 1}` },
  });
  return {
    read: () => application.read(fixture.root),
    prepare: () => fixture.store.prepare(fixture.root),
    execute: (command: unknown) => application.execute(fixture.root, command),
  };
}

describe('OperationRunner root mutation coordinator', () => {
  const roots: string[] = [];

  afterEach(() => {
    vi.restoreAllMocks();
    for (const rootPath of roots.splice(0)) fs.rmSync(rootPath, { recursive: true, force: true });
  });

  it('serializes two first-use creates and lets the second observe canonical state', async () => {
    const fixture = createFixture();
    roots.push(fixture.rootPath);
    const lock = new RootMutationLock();
    const lockRun = vi.spyOn(lock, 'run');
    const prepare = vi.spyOn(fixture.store, 'prepare');
    const runner = new OperationRunner([], {
      rootMutationLock: lock,
      rootMutationCoordinator: { forRoot: () => coordinatorFor(fixture) },
    });

    const command = (name: string) => ({
      version: 1 as const,
      type: 'create' as const,
      name,
      source: { source: 'local' as const },
      config,
    });
    const [first, second] = await Promise.all([
      runner.commitControlPlane(fixture.rootPath, command('First Pack')),
      runner.commitControlPlane(fixture.rootPath, command('Second Pack')),
    ]);

    expect(first).toMatchObject({ status: 'committed' });
    expect(second).toMatchObject({ status: 'committed' });
    expect(lockRun).toHaveBeenCalledTimes(2);
    expect(prepare).toHaveBeenCalledTimes(1);
    await expect(runner.readControlPlane(fixture.rootPath)).resolves.toMatchObject({
      status: 'ready',
      snapshot: { records: [{ name: 'First Pack' }, { name: 'Second Pack' }] },
    });
  });

  it('keeps ordinary reads write-free and creates canonical state explicitly', async () => {
    const fixture = createFixture();
    roots.push(fixture.rootPath);
    const prepare = vi.spyOn(fixture.store, 'prepare');
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
    })).resolves.toMatchObject({ status: 'committed' });
    expect(prepare).toHaveBeenCalledTimes(1);
    expect(fs.existsSync(path.join(fixture.rootPath, 'instance-control-plane.json'))).toBe(true);
  });

  it('lets an operation adapter commit through its already-held runner scope without recursively locking', async () => {
    const fixture = createFixture();
    roots.push(fixture.rootPath);
    await fixture.store.commit(fixture.root, initialSnapshot);
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
