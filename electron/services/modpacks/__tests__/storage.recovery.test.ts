import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadModpacksMetadata, saveModpacksMetadata } from '../storage';

describe('modpack metadata recovery', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('does not turn malformed metadata into an empty index', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fmcl-metadata-'));
    tempDirs.push(root);
    const metadataPath = path.join(root, 'modpacks-metadata.json');
    fs.writeFileSync(metadataPath, '{broken');
    const original = fs.readFileSync(metadataPath);

    expect(() => loadModpacksMetadata(root)).toThrow(/recovery backup are unavailable/);
    expect(() => saveModpacksMetadata(root, {
      selectedModpack: 'default',
      modpacks: {},
    })).toThrow(/without a recovery backup/);
    expect(fs.readFileSync(metadataPath)).toEqual(original);
  });

  it('reads the last-known-good backup when the primary is malformed', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fmcl-metadata-'));
    tempDirs.push(root);
    const metadataPath = path.join(root, 'modpacks-metadata.json');
    fs.writeFileSync(metadataPath, '{broken');
    fs.writeFileSync(`${metadataPath}.bak`, JSON.stringify({
      _fmclSchemaVersion: 1,
      selectedModpack: 'pack-one',
      modpacks: {
        'pack-one': { id: 'pack-one', name: 'Recovered' },
      },
    }));

    expect(loadModpacksMetadata(root)).toMatchObject({
      selectedModpack: 'pack-one',
      modpacks: { 'pack-one': { name: 'Recovered' } },
    });
    expect(fs.readFileSync(metadataPath, 'utf8')).toBe('{broken');
  });
});
