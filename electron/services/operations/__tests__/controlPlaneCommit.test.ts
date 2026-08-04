import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InstanceApplication } from '../../../domains/instances/instanceApplication';
import type { InstanceEditableConfig, LauncherRoot } from '../../../domains/instances/instanceTypes';
import { JsonControlPlaneStore } from '../../../infrastructure/instances/jsonControlPlaneStore';
import { OperationRunner } from '../operationRunner';

const config: InstanceEditableConfig = {
  runtime: { minecraftVersion: '1.21.1' },
  memory: { maxMb: 4096 },
};

type Fixture = { rootPath: string; root: LauncherRoot; store: JsonControlPlaneStore };

function createFixture(options: { afterPublish?: () => void; withLegacy?: boolean } = {}): Fixture {
  const rootPath = fs.mkdtempSync(path.join(os.tmpdir(), 'fmcl-control-plane-commit-'));
  const root = {} as LauncherRoot;
  if (options.withLegacy !== false) {
    fs.writeFileSync(path.join(rootPath, 'modpacks.json'), JSON.stringify({
      _fmclSchemaVersion: 1, selectedModpack: 'pack-one', modpacks: { 'pack-one': { name: 'Pack One' } },
    }));
    fs.writeFileSync(path.join(rootPath, 'modpacks-metadata.json'), JSON.stringify({
      _fmclSchemaVersion: 1, selectedModpack: 'pack-one', modpacks: {
        'pack-one': { id: 'pack-one', name: 'Pack One', source: 'local', minecraftVersion: '1.21.1', createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z' },
      },
    }));
    fs.mkdirSync(path.join(rootPath, 'modpacks', 'pack-one'), { recursive: true });
    fs.writeFileSync(path.join(rootPath, 'modpacks', 'pack-one', 'modpack.json'), JSON.stringify({
      _fmclSchemaVersion: 1, id: 'pack-one', name: 'Pack One', runtime: { minecraft: '1.21.1' }, memory: { maxMb: 4096 }, vmOptions: [],
      createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z',
    }));
  }
  return {
    rootPath,
    root,
    store: new JsonControlPlaneStore(() => rootPath, options),
  };
}

function coordinatorFor(fixture: Fixture, execute = (command: unknown) => applicationFor(fixture).execute(fixture.root, command)) {
  return {
    read: () => fixture.store.read(fixture.root),
    prepare: () => fixture.store.prepareFromLegacy(fixture.root),
    execute,
  };
}

function applicationFor(fixture: Fixture): InstanceApplication {
  return new InstanceApplication({
    controlPlane: fixture.store,
    clock: { now: () => '2026-08-04T00:00:00.000Z' },
    ids: { next: () => 'created-pack' },
  });
}

describe('OperationRunner control-plane commits', () => {
  const roots: string[] = [];

  afterEach(() => {
    vi.restoreAllMocks();
    for (const rootPath of roots.splice(0)) fs.rmSync(rootPath, { recursive: true, force: true });
  });

  it('returns a serializable typed failure, releases the scope, and permits a retry', async () => {
    const fixture = createFixture();
    roots.push(fixture.rootPath);
    let attempts = 0;
    const runner = new OperationRunner([], {
      rootMutationCoordinator: {
        forRoot: () => coordinatorFor(fixture, async (command) => {
          attempts += 1;
          if (attempts === 1) throw new Error('injected commit failure');
          return await applicationFor(fixture).execute(fixture.root, command);
        }),
      },
    });

    const command = {
      version: 1 as const,
      type: 'create' as const,
      name: 'Retry Pack',
      source: { source: 'local' as const },
      config,
    };
    const first = await runner.commitControlPlane(fixture.rootPath, command);
    const second = await runner.commitControlPlane(fixture.rootPath, command);

    expect(JSON.parse(JSON.stringify(first))).toEqual(first);
    expect(first).toMatchObject({ status: 'failed', code: 'ROOT_MUTATION_FAILED', message: 'injected commit failure' });
    expect(second).toMatchObject({ status: 'committed' });
    if (second.status === 'committed') {
      expect(second.snapshot.records).toContainEqual(expect.objectContaining({ name: 'Retry Pack' }));
    }
  });

  it('returns canonical provenance on retry after a post-publish preparation crash', async () => {
    const fixture = createFixture({ afterPublish: () => { throw new Error('injected post-publish crash'); } });
    roots.push(fixture.rootPath);
    const crashed = new OperationRunner([], { rootMutationCoordinator: { forRoot: () => coordinatorFor(fixture) } });

    await expect(crashed.prepareControlPlane(fixture.rootPath)).resolves.toMatchObject({
      status: 'failed', code: 'ROOT_MUTATION_PREPARE_FAILED', message: 'injected post-publish crash',
    });

    const recovered = new OperationRunner([], { rootMutationCoordinator: { forRoot: () => coordinatorFor(fixture) } });
    await expect(recovered.prepareControlPlane(fixture.rootPath)).resolves.toMatchObject({
      status: 'ready', source: 'canonical', snapshot: { selectedId: 'pack-one' },
    });
  });

  it('does not commit after cancellation and leaves the runner recoverable for a later prepare', async () => {
    const fixture = createFixture({ withLegacy: false });
    roots.push(fixture.rootPath);
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const runner = new OperationRunner([{
      kind: 'duplicate',
      run: async (context) => {
        await gate;
        await context.commitControlPlane({
          version: 1, type: 'create', name: 'Cancelled Pack', source: { source: 'local' }, config,
        });
        return { status: 'succeeded', instanceId: 'created-pack' };
      },
    }], { rootMutationCoordinator: { forRoot: () => coordinatorFor(fixture) } });

    const started = runner.start({ kind: 'duplicate', rootPath: fixture.rootPath, sourceId: 'source' });
    await vi.waitFor(() => expect(runner.get(started.id)?.status).toBe('running'));
    expect(runner.cancel(started.id)).toBe(true);
    release?.();

    await expect(runner.waitFor(started.id)).resolves.toMatchObject({ status: 'cancelled' });
    await expect(runner.readControlPlane(fixture.rootPath)).resolves.toEqual({ status: 'uninitialized' });
    await expect(runner.prepareControlPlane(fixture.rootPath)).resolves.toMatchObject({ status: 'uninitialized' });
  });
});
