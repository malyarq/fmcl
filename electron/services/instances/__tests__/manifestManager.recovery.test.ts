import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { InstanceManifestManager } from '../manifestManager';

describe('InstanceManifestManager recovery', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('versions new manifests and refuses to mutate a malformed manifest', () => {
    const instancePath = fs.mkdtempSync(path.join(os.tmpdir(), 'burrow-manifest-'));
    tempDirs.push(instancePath);
    const manager = new InstanceManifestManager();
    const manifestPath = path.join(instancePath, 'instance-manifest.json');

    manager.saveManifest(instancePath, { version: 1, mods: [] });
    expect(JSON.parse(fs.readFileSync(manifestPath, 'utf8'))).toMatchObject({
      _burrowSchemaVersion: 1,
      version: 1,
      mods: [],
    });

    fs.rmSync(`${manifestPath}.bak`, { force: true });
    fs.writeFileSync(manifestPath, '{broken manifest');
    const original = fs.readFileSync(manifestPath);

    expect(() => manager.addMod(instancePath, {
      fileName: 'example.jar',
      source: 'modrinth',
      projectId: 'project',
      versionId: 'version',
      installDate: '2026-08-03T00:00:00.000Z',
    })).toThrow(/recovery backup are unavailable/);
    expect(fs.readFileSync(manifestPath)).toEqual(original);
  });
});
