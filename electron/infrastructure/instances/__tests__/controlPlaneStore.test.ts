import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { CanonicalInstanceSnapshot, LauncherRoot } from '../../../domains/instances/instanceTypes';
import { JsonControlPlaneStore } from '../jsonControlPlaneStore';

const snapshot: CanonicalInstanceSnapshot = {
  selectedId: 'pack-one',
  records: [{
    id: 'pack-one',
    name: 'Pack One',
    source: {
      source: 'local',
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
    },
    config: { runtime: { minecraftVersion: '1.21.1' } },
    summary: { minecraftVersion: '1.21.1' },
  }],
};

describe('JsonControlPlaneStore', () => {
  const roots: string[] = [];

  afterEach(() => {
    for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
  });

  function createStore() {
    const rootPath = fs.mkdtempSync(path.join(os.tmpdir(), 'burrow-control-plane-'));
    const root = {} as LauncherRoot;
    roots.push(rootPath);
    return { rootPath, root, store: new JsonControlPlaneStore(() => rootPath) };
  }

  it('reports an empty root without creating state', async () => {
    const { rootPath, root, store } = createStore();

    await expect(store.read(root)).resolves.toEqual({ status: 'uninitialized' });
    await expect(store.prepare(root)).resolves.toEqual({ status: 'uninitialized' });
    expect(fs.existsSync(path.join(rootPath, 'instance-control-plane.json'))).toBe(false);
  });

  it('publishes and reads the canonical snapshot', async () => {
    const { rootPath, root, store } = createStore();

    await store.commit(root, snapshot);

    await expect(store.prepare(root)).resolves.toEqual({ status: 'ready', source: 'canonical', snapshot });
    expect(JSON.parse(fs.readFileSync(path.join(rootPath, 'instance-control-plane.json'), 'utf8'))).toMatchObject({
      _burrowSchemaVersion: 1,
      snapshot: { selectedId: 'pack-one' },
    });
  });

  it('requires recovery when canonical state is corrupt', async () => {
    const { rootPath, root, store } = createStore();
    fs.writeFileSync(path.join(rootPath, 'instance-control-plane.json'), '{not-json');

    await expect(store.prepare(root)).resolves.toMatchObject({
      status: 'recovery-required',
      reason: expect.stringContaining('Canonical control-plane is unavailable'),
    });
  });
});
