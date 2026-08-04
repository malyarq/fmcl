import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { ModpackManifest } from '../../../../shared/types/modpack';
import type { LauncherRoot } from '../../../domains/instances/instanceTypes';
import type { InstanceReadPort, LauncherRootResolver } from '../../../domains/instances/ports';
import { InstanceModContentService } from '../instanceModContentService';

function createInstance(): { rootPath: string; instancePath: string } {
  const rootPath = fs.mkdtempSync(path.join(os.tmpdir(), 'fmcl-instance-mods-'));
  const instancePath = path.join(rootPath, 'modpacks', 'pack');
  fs.mkdirSync(path.join(instancePath, 'mods'), { recursive: true });
  return { rootPath, instancePath };
}

function createService(rootPath: string): InstanceModContentService {
  const root = {} as LauncherRoot;
  const instances: InstanceReadPort = {
    async read() {
      return {
        status: 'ready',
        snapshot: {
          selectedId: 'pack',
          records: [{
            id: 'pack',
            name: 'Pack',
            source: {
              source: 'local',
              version: '2.0.0',
              createdAt: '2026-08-04T00:00:00.000Z',
              updatedAt: '2026-08-04T00:00:00.000Z',
            },
            config: {
              runtime: {
                minecraftVersion: '1.20.1',
                modLoader: { type: 'fabric', version: '0.16.0' },
              },
            },
            summary: {
              minecraftVersion: '1.20.1',
              modLoader: { type: 'fabric', version: '0.16.0' },
            },
          }],
        },
      };
    },
  };
  const rootResolver: LauncherRootResolver = { async resolve() { return root; } };
  return new InstanceModContentService(rootPath, instances, rootResolver);
}

describe('InstanceModContentService', () => {
  const roots: string[] = [];

  afterEach(() => {
    for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
  });

  it('creates a manifest from canonical state when instances:create has not written modpack.json', async () => {
    const { rootPath, instancePath } = createInstance();
    roots.push(rootPath);
    fs.rmSync(instancePath, { recursive: true, force: true });
    const service = createService(rootPath);

    await service.register('pack', { platform: 'modrinth', projectId: 'sodium', versionId: 'v1' });

    const manifest = JSON.parse(fs.readFileSync(path.join(instancePath, 'manifest.json'), 'utf8')) as ModpackManifest;
    expect(manifest.minecraft).toEqual({
      version: '1.20.1',
      modLoaders: [{ id: 'fabric-0.16.0', primary: true }],
    });
    expect(manifest.version).toBe('2.0.0');
    expect(manifest.files).toEqual([{ projectId: 'sodium', versionId: 'v1', required: true }]);
  });

  it('removes a mod file and its path-based manifest entry', () => {
    const { rootPath, instancePath } = createInstance();
    roots.push(rootPath);
    fs.writeFileSync(path.join(instancePath, 'mods', 'example.jar'), 'jar');
    fs.writeFileSync(path.join(instancePath, 'manifest.json'), JSON.stringify({
      formatVersion: 1,
      minecraft: { version: '1.20.1', modLoaders: [] },
      name: 'Pack',
      version: '1.0.0',
      files: [{ path: 'mods/example.jar', hashes: { sha1: 'a', sha512: 'b' }, downloads: [], required: true }],
    }));

    createService(rootPath).remove('pack', 'example.jar');

    expect(fs.existsSync(path.join(instancePath, 'mods', 'example.jar'))).toBe(false);
    const manifest = JSON.parse(fs.readFileSync(path.join(instancePath, 'manifest.json'), 'utf8')) as ModpackManifest;
    expect(manifest.files).toEqual([]);
  });

  it('does not overwrite the opposite enabled state and rejects path-shaped names', () => {
    const { rootPath, instancePath } = createInstance();
    roots.push(rootPath);
    fs.writeFileSync(path.join(instancePath, 'mods', 'example.jar'), 'enabled');
    fs.writeFileSync(path.join(instancePath, 'mods', 'example.jar.disabled'), 'disabled');
    const service = createService(rootPath);

    expect(() => service.setEnabled('pack', 'example.jar.disabled', true)).toThrow(/already exists/i);
    expect(() => service.remove('pack', '../escape.jar')).toThrow(/mod filename/i);
    expect(fs.readFileSync(path.join(instancePath, 'mods', 'example.jar'), 'utf8')).toBe('enabled');
  });

  it('rejects non-numeric CurseForge registrations inside the main-only service', async () => {
    const { rootPath } = createInstance();
    roots.push(rootPath);
    const service = createService(rootPath);

    await expect(service.register('pack', {
      platform: 'curseforge',
      projectId: 'not-a-number',
      versionId: '42',
    })).rejects.toThrow(/safe integers/i);
  });
});
