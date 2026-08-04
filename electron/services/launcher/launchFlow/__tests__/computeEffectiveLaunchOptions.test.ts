import { describe, expect, it, vi } from 'vitest';
import type { CanonicalInstanceRecord, LauncherRoot } from '../../../../domains/instances/instanceTypes';
import type { InstanceReadPort, LauncherRootResolver } from '../../../../domains/instances/ports';
import type { LaunchAdapters } from '../../../../infrastructure/instances/launchAdapters';
import { computeEffectiveLaunchOptions } from '../computeEffectiveLaunchOptions';
import { prepareLaunchContext } from '../../preLaunchSetup';

const root = '/launcher-root' as unknown as LauncherRoot;

const record: CanonicalInstanceRecord = {
  id: 'fabric-pack',
  name: 'Fabric pack',
  source: { source: 'local', createdAt: '2026-08-04T00:00:00.000Z', updatedAt: '2026-08-04T00:00:00.000Z' },
  config: {
    runtime: { minecraftVersion: '1.21.1', modLoader: { type: 'fabric' } },
    java: { executable: '/java/21/bin/java' },
    memory: { minMb: 1024, maxMb: 6144 },
    vmOptions: ['-Dpack=true', ''],
    game: { extraArgs: ['--demo', ''], resolution: { width: 1920, height: 1080 } },
    server: { host: 'play.example.test', port: 25565 },
  },
  summary: { minecraftVersion: '1.21.1', modLoader: { type: 'fabric' } },
};

const rootResolver: LauncherRootResolver = {
  resolve: vi.fn(async () => root),
};

const native = {
  rootPath: vi.fn(() => '/launcher-root'),
  instancePath: vi.fn((_root: LauncherRoot, instanceId: string) => `/launcher-root/modpacks/${instanceId}`),
  ensureInstanceDirectory: vi.fn(),
} as unknown as LaunchAdapters;

function readerFor(snapshot: readonly CanonicalInstanceRecord[] = [record]): InstanceReadPort {
  return {
    read: vi.fn(async () => ({ status: 'ready' as const, snapshot: { selectedId: snapshot[0]?.id ?? null, records: snapshot } })),
  };
}

describe('canonical launch options', () => {
  it('derives Java, memory, game and server options from the canonical config DTO', () => {
    expect(computeEffectiveLaunchOptions({
      options: { version: '1.20.4', ram: 2 },
      config: record.config,
    })).toEqual({
      requestedVersion: '1.21.1-Fabric',
      ramGb: 6,
      minRamGb: 1,
      effectiveJavaPath: '/java/21/bin/java',
      effectiveVmOptions: ['-Dpack=true'],
      effectiveMcArgs: ['--demo'],
      effectiveResolution: { width: 1920, height: 1080 },
      effectiveServer: { ip: 'play.example.test', port: 25565 },
    });
  });

  it('reads exactly one canonical snapshot and selects its requested record', async () => {
    const instances = readerFor();

    const context = await prepareLaunchContext({
      instances,
      rootResolver,
      native,
      launcherRootPath: '/launcher-root',
      options: { nickname: 'Player', version: '1.20.4', ram: 2, instanceId: 'fabric-pack' },
    });

    expect(instances.read).toHaveBeenCalledTimes(1);
    expect(rootResolver.resolve).toHaveBeenCalledWith('/launcher-root');
    expect(context.record).toBe(record);
    expect(context.instancePath).toBe('/launcher-root/modpacks/fabric-pack');
  });

  it('propagates canonical-state failures without a renderer or path fallback', async () => {
    const error = new Error('Canonical state is corrupt');
    const instances: InstanceReadPort = { read: vi.fn(async () => { throw error; }) };

    await expect(prepareLaunchContext({
      instances,
      rootResolver,
      native,
      launcherRootPath: '/launcher-root',
      options: { nickname: 'Player', version: '1.20.4', ram: 2, instanceId: 'fabric-pack' },
    })).rejects.toBe(error);
  });

  it('rejects an uninitialized canonical state instead of deriving a config from renderer options', async () => {
    const instances: InstanceReadPort = { read: vi.fn(async () => ({ status: 'uninitialized' as const })) };

    await expect(prepareLaunchContext({
      instances,
      rootResolver,
      native,
      launcherRootPath: '/launcher-root',
      options: { nickname: 'Player', version: '1.20.4', ram: 2, instanceId: 'fabric-pack' },
    })).rejects.toThrow('Canonical instance state is uninitialized');
  });

  it('creates the classic profile transiently without reading or persisting canonical config', async () => {
    const instances = readerFor();

    const context = await prepareLaunchContext({
      instances,
      rootResolver,
      native,
      launcherRootPath: '/launcher-root',
      options: { nickname: 'Player', version: '1.20.4', ram: 4, instanceId: 'classic' },
    });

    expect(instances.read).not.toHaveBeenCalled();
    expect(context.record.config.runtime.minecraftVersion).toBe('1.20.4');
    expect(context.record.source.source).toBe('local');
  });
});
