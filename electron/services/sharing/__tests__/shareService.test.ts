import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ModpackConfig } from '../../instances/types';
import { ShareService } from '../shareService';
import type { ModpackService } from '../../modpacks/modpackService';

type ShareModpackService = Pick<ModpackService, 'getDefaultRootPath' | 'loadModpackConfig' | 'getModpackDir'>;

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

function encodeShareCode(payload: MiniManifestPayload): string {
  const encoded = gzipSync(Buffer.from(JSON.stringify(payload), 'utf-8')).toString('base64');

  return `fmcl://share/v1/${encoded}`;
}

describe('ShareService', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    vi.restoreAllMocks();

    for (const dir of tempDirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('round-trips a generated share code into a manifest', async () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fmcl-share-'));
    tempDirs.push(rootDir);

    const instanceDir = path.join(rootDir, 'instances', 'fabric-pack');
    fs.mkdirSync(instanceDir, { recursive: true });
    fs.writeFileSync(
      path.join(instanceDir, 'instance-manifest.json'),
      JSON.stringify({
        version: 1,
        mods: [
          {
            fileName: 'example-curseforge.jar',
            source: 'curseforge',
            projectId: '42',
            versionId: '84',
            installDate: '2026-04-12T00:00:00.000Z',
          },
          {
            fileName: 'example-modrinth.jar',
            source: 'modrinth',
            projectId: 'modrinth-project',
            versionId: 'modrinth-version',
            installDate: '2026-04-12T00:00:00.000Z',
          },
        ],
      }),
      'utf-8',
    );

    const config: ModpackConfig = {
      id: 'fabric-pack',
      name: 'Fabric Pack',
      runtime: {
        minecraft: '1.20.1',
        modLoader: {
          type: 'fabric',
          version: '0.16.0',
        },
      },
      memory: { maxMb: 4096 },
      vmOptions: [],
      createdAt: '2026-04-12T00:00:00.000Z',
      updatedAt: '2026-04-12T00:00:00.000Z',
    };

    const modpackService: ShareModpackService = {
      getDefaultRootPath: () => rootDir,
      loadModpackConfig: () => config,
      getModpackDir: () => instanceDir,
    };

    const service = new ShareService(modpackService as unknown as ModpackService);

    const shareCode = await service.generateShareCode('fabric-pack');
    expect(shareCode.startsWith('fmcl://share/v1/')).toBe(true);

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

  it('wraps generation failures with a stable public error', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const modpackService: ShareModpackService = {
      getDefaultRootPath: () => '/tmp',
      loadModpackConfig: () => {
        throw new Error('broken config');
      },
      getModpackDir: () => '/tmp',
    };

    const service = new ShareService(modpackService as unknown as ModpackService);

    await expect(service.generateShareCode('broken-pack')).rejects.toThrow('Failed to generate share code');
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it('rejects corrupted or unsupported share codes with the public error', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const modpackService = {
      getDefaultRootPath: () => '/tmp',
      loadModpackConfig: () => {
        throw new Error('unused');
      },
      getModpackDir: () => '/tmp',
    };
    const service = new ShareService(modpackService as unknown as ModpackService);

    await expect(service.resolveShareCode('fmcl://share/v1/not-base64')).rejects.toThrow(
      'Invalid or corrupted share code',
    );

    await expect(service.resolveShareCode('fmcl://share/v2/not-supported')).rejects.toThrow(
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
});
