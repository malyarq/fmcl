import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({ app: { getPath: () => '/tmp/fmcl-test-user-data' } }));

import { DatapackService } from '../datapacksService';

describe('DatapackService path boundaries', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
  });

  function createModpack(): { root: string; instance: string } {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fmcl-datapacks-'));
    tempDirs.push(root);
    const instance = path.join(root, 'modpacks', 'safe-pack');
    fs.mkdirSync(path.join(instance, 'saves', 'world', 'datapacks'), { recursive: true });
    fs.writeFileSync(path.join(root, 'modpacks.json'), '{}');
    return { root, instance };
  }

  it('rejects world traversal before reading files', async () => {
    const { instance } = createModpack();
    const service = new DatapackService();

    await expect(service.list(instance, '../../outside')).rejects.toThrow('World folder');
  });

  it('rejects file traversal before deletion', async () => {
    const { root, instance } = createModpack();
    const outside = path.join(root, 'outside.txt');
    fs.writeFileSync(outside, 'keep');
    const service = new DatapackService();

    await expect(service.delete(instance, 'world', '../../../outside.txt')).rejects.toThrow('Datapack name');
    expect(fs.readFileSync(outside, 'utf8')).toBe('keep');
  });
});
