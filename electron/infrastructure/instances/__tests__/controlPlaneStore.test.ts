import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { LauncherRoot } from '../../../domains/instances/instanceTypes';
import { JsonControlPlaneStore } from '../jsonControlPlaneStore';

function snapshot() {
  return {
    selectedId: 'pack-one',
    records: [{
      id: 'pack-one',
      name: 'Pack One',
      source: { source: 'local' as const, createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-02T00:00:00.000Z' },
      config: { runtime: { minecraftVersion: '1.21.1' } },
      summary: { minecraftVersion: '1.21.1' },
    }],
  };
}

describe('JsonControlPlaneStore', () => {
  const roots: string[] = [];

  afterEach(() => {
    for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
  });

  function createStore() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'burrow-control-plane-store-'));
    roots.push(root);
    const rootCapability = {} as LauncherRoot;
    return {
      root,
      rootCapability,
      store: new JsonControlPlaneStore((candidate) => {
        if (candidate !== rootCapability) throw new Error('unexpected root capability');
        return root;
      }),
    };
  }

  it('validates and deep-copies writes and reads through one versioned document', async () => {
    const { root, rootCapability, store } = createStore();
    const persisted = snapshot();
    const mutablePersisted = persisted as unknown as { records: Array<{ name: string }> };

    await store.commit(rootCapability, persisted);
    mutablePersisted.records[0].name = 'Mutated after commit';
    const first = await store.read(rootCapability);
    if (first.status !== 'ready') throw new Error('expected canonical state');
    (first.snapshot as unknown as { records: Array<{ name: string }> }).records[0].name = 'Mutated after read';

    await expect(store.read(rootCapability)).resolves.toMatchObject({
      status: 'ready',
      snapshot: { records: [{ name: 'Pack One' }] },
    });
    expect(fs.readdirSync(root).filter((entry) => entry.startsWith('instance-control-plane.json'))).toEqual([
      'instance-control-plane.json',
    ]);
  });

  it('recovers a corrupt canonical primary from its AtomicJsonStore backup without legacy migration', async () => {
    const { root, rootCapability, store } = createStore();
    await store.commit(rootCapability, snapshot());
    const second = snapshot();
    second.records[0].name = 'Second';
    await store.commit(rootCapability, second);
    fs.writeFileSync(path.join(root, 'instance-control-plane.json'), '{broken');

    await expect(store.read(rootCapability)).resolves.toMatchObject({
      status: 'ready',
      snapshot: { records: [{ name: 'Pack One' }] },
    });
  });

  it('rejects malformed canonical values before publication', async () => {
    const { root, rootCapability, store } = createStore();
    const malformed = snapshot() as unknown as { records: Array<{ source: { sourceId?: unknown } }> };
    malformed.records[0].source.sourceId = 42;

    await expect(store.commit(rootCapability, malformed as never)).rejects.toThrow(/sourceId/i);
    expect(fs.existsSync(path.join(root, 'instance-control-plane.json'))).toBe(false);
  });
});
