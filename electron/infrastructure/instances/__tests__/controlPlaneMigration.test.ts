import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LauncherRoot } from '../../../domains/instances/instanceTypes';
import { AtomicJsonStore } from '../../../services/storage/atomicJsonStore';
import { JsonControlPlaneStore } from '../jsonControlPlaneStore';

type LegacyFixture = {
  root: string;
  rootCapability: LauncherRoot;
  store: JsonControlPlaneStore;
  legacyPaths: string[];
};

const schema = { _fmclSchemaVersion: 1 };

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

function createFixture(options: {
  index?: unknown;
  metadata?: unknown;
  config?: unknown;
  withoutConfig?: boolean;
} = {}): LegacyFixture {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fmcl-control-plane-migration-'));
  const rootCapability = {} as LauncherRoot;
  const indexPath = path.join(root, 'modpacks.json');
  const metadataPath = path.join(root, 'modpacks-metadata.json');
  const configPath = path.join(root, 'modpacks', 'pack-one', 'modpack.json');
  writeJson(indexPath, options.index ?? {
    ...schema,
    selectedModpack: 'pack-one',
    modpacks: { 'pack-one': { name: 'Pack One' } },
  });
  writeJson(metadataPath, options.metadata ?? {
    ...schema,
    selectedModpack: 'pack-one',
    modpacks: {
      'pack-one': {
        id: 'pack-one',
        name: 'Pack One',
        source: 'modrinth',
        sourceId: 'project-one',
        sourceVersionId: 'version-one',
        minecraftVersion: '1.21.1',
        modLoader: { type: 'fabric', version: '0.16.0' },
        createdAt: '2026-08-01T00:00:00.000Z',
        updatedAt: '2026-08-02T00:00:00.000Z',
      },
    },
  });
  if (!options.withoutConfig) {
    writeJson(configPath, options.config ?? {
      ...schema,
      id: 'pack-one',
      name: 'Pack One',
      runtime: { minecraft: '1.21.1', modLoader: { type: 'fabric', version: '0.16.0' } },
      memory: { maxMb: 4096 },
      vmOptions: ['-Dexample=true'],
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-02T00:00:00.000Z',
    });
  }

  return {
    root,
    rootCapability,
    store: new JsonControlPlaneStore((rootValue) => {
      if (rootValue !== rootCapability) throw new Error('unexpected root capability');
      return root;
    }),
    legacyPaths: [indexPath, metadataPath, ...(options.withoutConfig ? [] : [configPath])],
  };
}

function captureBytes(paths: string[]): Map<string, Buffer> {
  return new Map(paths.map((filePath) => [filePath, fs.readFileSync(filePath)]));
}

function expectBytesUnchanged(bytes: Map<string, Buffer>): void {
  for (const [filePath, expected] of bytes) {
    expect(fs.readFileSync(filePath)).toEqual(expected);
  }
}

describe('JsonControlPlaneStore legacy preparation', () => {
  const roots: string[] = [];

  afterEach(() => {
    vi.restoreAllMocks();
    for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
  });

  it('does not import or write legacy state through an ordinary uninitialized read', async () => {
    const fixture = createFixture();
    roots.push(fixture.root);
    const before = captureBytes(fixture.legacyPaths);

    await expect(fixture.store.read(fixture.rootCapability)).resolves.toEqual({ status: 'uninitialized' });
    expect(fs.existsSync(path.join(fixture.root, 'instance-control-plane.json'))).toBe(false);
    expectBytesUnchanged(before);
  });

  it('migrates exactly a known v0.7 triplet and leaves every legacy byte inert', async () => {
    const fixture = createFixture();
    roots.push(fixture.root);
    const before = captureBytes(fixture.legacyPaths);

    await expect(fixture.store.prepareFromLegacy(fixture.rootCapability)).resolves.toMatchObject({
      status: 'ready',
      source: 'legacy-migration',
      snapshot: {
        selectedId: 'pack-one',
        records: [{
          id: 'pack-one',
          name: 'Pack One',
          config: { runtime: { minecraftVersion: '1.21.1' } },
        }],
      },
    });
    expectBytesUnchanged(before);
    expect(JSON.parse(fs.readFileSync(path.join(fixture.root, 'instance-control-plane.json'), 'utf8'))).toMatchObject({
      _fmclSchemaVersion: 1,
      migrationProvenance: { source: 'v0.7' },
    });
  });

  it('reports a canonical write failure without touching legacy bytes', async () => {
    const fixture = createFixture();
    roots.push(fixture.root);
    const before = captureBytes(fixture.legacyPaths);
    vi.spyOn(AtomicJsonStore.prototype, 'write').mockImplementationOnce(() => {
      throw new Error('injected canonical write failure');
    });

    await expect(fixture.store.prepareFromLegacy(fixture.rootCapability)).resolves.toMatchObject({
      status: 'recovery-required',
      reason: expect.stringContaining('injected canonical write failure'),
    });
    expect(fs.existsSync(path.join(fixture.root, 'instance-control-plane.json'))).toBe(false);
    expectBytesUnchanged(before);
  });

  it('uses published migration provenance after a post-publish crash and never re-imports stale legacy bytes', async () => {
    const fixture = createFixture();
    roots.push(fixture.root);
    const before = captureBytes(fixture.legacyPaths);
    const crashed = new JsonControlPlaneStore(() => fixture.root, {
      afterPublish: () => { throw new Error('injected readback crash'); },
    });

    await expect(crashed.prepareFromLegacy(fixture.rootCapability)).rejects.toThrow('injected readback crash');
    writeJson(fixture.legacyPaths[0], { ...schema, selectedModpack: 'stale', modpacks: { stale: { name: 'Stale' } } });

    await expect(fixture.store.prepareFromLegacy(fixture.rootCapability)).resolves.toMatchObject({
      status: 'ready',
      source: 'canonical',
      snapshot: { selectedId: 'pack-one' },
    });
    expect(fs.readFileSync(fixture.legacyPaths[0])).not.toEqual(before.get(fixture.legacyPaths[0]));
  });

  it('is repeat-safe and gives a concurrent retry the canonical result', async () => {
    const fixture = createFixture();
    roots.push(fixture.root);
    const retry = vi.fn(async () => fixture.store.prepareFromLegacy(fixture.rootCapability));
    const publishing = new JsonControlPlaneStore(() => fixture.root, { afterPublish: retry });

    const first = await publishing.prepareFromLegacy(fixture.rootCapability);
    const second = await fixture.store.prepareFromLegacy(fixture.rootCapability);

    expect(first).toMatchObject({ status: 'ready', source: 'legacy-migration' });
    await expect(retry).toHaveResolvedWith(expect.objectContaining({ status: 'ready', source: 'canonical' }));
    expect(second).toMatchObject({ status: 'ready', source: 'canonical' });
  });

  it.each<[string, Record<string, unknown>]>([
    ['malformed JSON', { index: '{not-json' }],
    ['unsupported schema', { index: { ...schema, _fmclSchemaVersion: 2, selectedModpack: 'pack-one', modpacks: {} } }],
    ['mismatched id/name/config', { config: { ...schema, id: 'other', name: 'Other', runtime: { minecraft: '1.21.1' } } }],
    ['dangling selection', { index: { ...schema, selectedModpack: 'missing', modpacks: { 'pack-one': { name: 'Pack One' } } } }],
    ['ambiguous duplicate metadata ids', { metadata: { ...schema, selectedModpack: 'pack-one', modpacks: { 'pack-one': { id: 'pack-one', name: 'Pack One', source: 'local', minecraftVersion: '1.21.1', createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-02T00:00:00.000Z' }, 'pack-two': { id: 'pack-one', name: 'Pack Two', source: 'local', minecraftVersion: '1.21.1', createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-02T00:00:00.000Z' } } } }],
  ])('fails closed for %s', async (_label, input) => {
    const fixture = createFixture(typeof input.index === 'string'
      ? { ...input, index: JSON.parse(JSON.stringify(input.index)) }
      : input);
    roots.push(fixture.root);
    if (input.index === '{not-json') fs.writeFileSync(fixture.legacyPaths[0], input.index);
    const before = captureBytes(fixture.legacyPaths);

    await expect(fixture.store.prepareFromLegacy(fixture.rootCapability)).resolves.toMatchObject({
      status: 'recovery-required',
    });
    expect(fs.existsSync(path.join(fixture.root, 'instance-control-plane.json'))).toBe(false);
    expectBytesUnchanged(before);
  });

  it('only recovers a missing config when complete validated metadata makes it explicit', async () => {
    const fixture = createFixture({ withoutConfig: true });
    roots.push(fixture.root);
    const before = captureBytes(fixture.legacyPaths);

    await expect(fixture.store.prepareFromLegacy(fixture.rootCapability)).resolves.toMatchObject({
      status: 'ready',
      snapshot: { records: [{ config: { runtime: { minecraftVersion: '1.21.1' } } }] },
    });
    expectBytesUnchanged(before);
  });
});
