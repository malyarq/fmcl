import { gzipSync } from 'node:zlib';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { InstanceReadPort } from '../../../domains/instances/ports';
import type { CanonicalInstanceSnapshot, LauncherRoot } from '../../../domains/instances/instanceTypes';
import { ShareService, type ShareContentPort } from '../shareService';

interface MiniManifestPayload {
  v: number;
  n: string;
  mc: string;
  ml: {
    t: string;
    v?: string;
  };
  f: Array<{
    p?: number;
    f?: number;
    m?: string;
    v?: string;
  }>;
}

function encodeShareCode(payload: MiniManifestPayload | unknown): string {
  const encoded = gzipSync(Buffer.from(JSON.stringify(payload), 'utf-8')).toString('base64');

  return `burrow://share/v1/${encoded}`;
}

const root = '/tmp/burrow-share-root' as unknown as LauncherRoot;

function readySnapshot(): CanonicalInstanceSnapshot {
  return {
    selectedId: 'fabric-pack',
    records: [{
      id: 'fabric-pack',
      name: 'Fabric Pack',
      source: {
        source: 'local',
        createdAt: '2026-04-12T00:00:00.000Z',
        updatedAt: '2026-04-12T00:00:00.000Z',
      },
      config: {
        runtime: {
          minecraftVersion: '1.20.1',
          modLoader: {
            type: 'fabric',
            version: '0.16.0',
          },
        },
        memory: { maxMb: 4096 },
      },
      summary: {
        minecraftVersion: '1.20.1',
        modLoader: {
          type: 'fabric',
          version: '0.16.0',
        },
      },
    }],
  };
}

function createDependencies(): Readonly<{ instances: InstanceReadPort; content: ShareContentPort }> {
  return {
    instances: {
      read: async (requestedRoot) => {
        expect(requestedRoot).toBe(root);
        return { status: 'ready', snapshot: readySnapshot() };
      },
    },
    content: {
      resolveDefaultRoot: async () => root,
      loadManifest: async (requestedRoot, instanceId) => {
        expect(requestedRoot).toBe(root);
        expect(instanceId).toBe('fabric-pack');
        return {
          mods: [
            {
              source: 'curseforge',
              projectId: '42',
              versionId: '84',
            },
            {
              source: 'modrinth',
              projectId: 'modrinth-project',
              versionId: 'modrinth-version',
            },
          ],
        };
      },
    },
  };
}

describe('ShareService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('round-trips canonical configuration and injected manifest content into a share manifest', async () => {
    const { instances, content } = createDependencies();
    const service = new ShareService(instances, content);

    const shareCode = await service.generateShareCode('fabric-pack');
    expect(shareCode.startsWith('burrow://share/v1/')).toBe(true);

    const manifest = await service.resolveShareCode(shareCode);
    expect(manifest.name).toBe('Fabric Pack');
    expect(manifest.minecraft.version).toBe('1.20.1');
    expect(manifest.minecraft.modLoaders).toEqual([
      {
        id: 'fabric-0.16.0',
        primary: true,
      },
    ]);
    expect(manifest.files).toEqual([
      {
        projectID: 42,
        fileID: 84,
        projectId: undefined,
        versionId: undefined,
        required: true,
      },
      {
        projectID: undefined,
        fileID: undefined,
        projectId: 'modrinth-project',
        versionId: 'modrinth-version',
        required: true,
      },
    ]);
    expect(manifest.overrides).toBe('overrides');
  });

  it('keeps pre-rebrand Burrow share codes importable', async () => {
    const { instances, content } = createDependencies();
    const service = new ShareService(instances, content);
    const currentCode = encodeShareCode({ v: 1, n: 'Legacy Pack', mc: '1.20.1', ml: { t: 'vanilla' }, f: [] });

    await expect(service.resolveShareCode(currentCode.replace('burrow://', 'fmcl://'))).resolves.toMatchObject({
      name: 'Legacy Pack',
      minecraft: { version: '1.20.1' },
    });
  });

  it('wraps generation failures with a stable public error', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { content } = createDependencies();
    const instances: InstanceReadPort = {
      read: async () => {
        throw new Error('broken canonical snapshot');
      },
    };
    const service = new ShareService(instances, content);

    await expect(service.generateShareCode('broken-pack')).rejects.toThrow('Failed to generate share code');
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it('rejects corrupted or unsupported share codes with the public error', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { instances, content } = createDependencies();
    const service = new ShareService(instances, content);

    await expect(service.resolveShareCode('burrow://share/v1/not-base64')).rejects.toThrow(
      'Invalid or corrupted share code',
    );

    await expect(service.resolveShareCode('burrow://share/v2/not-supported')).rejects.toThrow(
      'Invalid or corrupted share code',
    );

    await expect(service.resolveShareCode(Buffer.from('plain text', 'utf-8').toString('base64'))).rejects.toThrow(
      'Invalid or corrupted share code',
    );

    await expect(
      service.resolveShareCode(
        encodeShareCode({
          v: 2,
          n: 'Unsupported Pack',
          mc: '1.20.1',
          ml: { t: 'vanilla' },
          f: [],
        }),
      ),
    ).rejects.toThrow('Invalid or corrupted share code');

    expect(consoleErrorSpy).toHaveBeenCalledTimes(4);
  });

  it('rejects bounded-decompression, oversized file lists, and malformed provider entries before creating a manifest', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { instances, content } = createDependencies();
    const service = new ShareService(instances, content);
    const valid = {
      v: 1,
      n: 'Shared Pack',
      mc: '1.21.1',
      ml: { t: 'fabric', v: '0.16.0' },
      f: [],
    };
    const gzipBomb = `burrow://share/v1/${gzipSync(Buffer.alloc(300 * 1024, 65)).toString('base64')}`;
    const oversizedFiles = encodeShareCode({ ...valid, f: Array.from({ length: 1_001 }, () => ({ m: 'project', v: 'version' })) });
    const malformedProvider = encodeShareCode({ ...valid, f: [{ p: 1, f: 2, m: 'project', v: 'version' }] });

    await expect(service.resolveShareCode(gzipBomb)).rejects.toThrow('Invalid or corrupted share code');
    await expect(service.resolveShareCode(oversizedFiles)).rejects.toThrow('Invalid or corrupted share code');
    await expect(service.resolveShareCode(malformedProvider)).rejects.toThrow('Invalid or corrupted share code');
    expect(consoleErrorSpy).toHaveBeenCalledTimes(3);
  });

  it('accepts a 120-character loader version and rejects a longer canonical-incompatible version', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { instances, content } = createDependencies();
    const service = new ShareService(instances, content);
    const payload = {
      v: 1,
      n: 'Shared Pack',
      mc: '1.21.1',
      ml: { t: 'fabric', v: 'x'.repeat(120) },
      f: [],
    };

    await expect(service.resolveShareCode(encodeShareCode(payload))).resolves.toMatchObject({
      minecraft: { modLoaders: [{ id: `fabric-${payload.ml.v}` }] },
    });
    await expect(service.resolveShareCode(encodeShareCode({ ...payload, ml: { ...payload.ml, v: 'x'.repeat(121) } }))).rejects.toThrow('Invalid or corrupted share code');
    expect(consoleErrorSpy).toHaveBeenCalledOnce();
  });

});
