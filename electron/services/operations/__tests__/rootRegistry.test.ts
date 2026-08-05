import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { OperationRootRegistry } from '../rootRegistry';
import { OperationRunner } from '../operationRunner';

describe('OperationRootRegistry', () => {
  const dirs: string[] = [];
  afterEach(() => dirs.splice(0).forEach((dir) => fs.rmSync(dir, { recursive: true, force: true })));
  it('keeps valid roots available when a descriptor primary and backup are corrupt', () => {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'fmcl-registry-')); dirs.push(base);
    const first = fs.mkdtempSync(path.join(os.tmpdir(), 'fmcl-root-one-')); const second = fs.mkdtempSync(path.join(os.tmpdir(), 'fmcl-root-two-')); dirs.push(first, second);
    const registry = new OperationRootRegistry(base); registry.register(first); registry.register(second);
    const directory = path.join(base, 'FriendLauncher', 'operation-roots');
    const corrupt = fs.readdirSync(directory).find((name) => name.endsWith('.json'))!;
    fs.writeFileSync(path.join(directory, corrupt), '{bad'); fs.writeFileSync(`${path.join(directory, corrupt)}.bak`, '{bad');
    const listed = registry.list();
    expect(listed.roots).toHaveLength(1); expect(listed.errors).toHaveLength(1); expect(fs.existsSync(path.join(directory, corrupt))).toBe(true);
  });

  it('creates and registers the default root during a clean first startup', async () => {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'fmcl-first-start-'));
    dirs.push(base);
    const defaultRoot = path.join(base, 'user-data', 'minecraft_data');
    const runner = new OperationRunner([], { registryPath: base });

    await expect(runner.recoverRegistered(defaultRoot)).resolves.toBeUndefined();

    expect(fs.statSync(defaultRoot).isDirectory()).toBe(true);
    expect(new OperationRootRegistry(base).list().roots).toContain(fs.realpathSync.native(defaultRoot));
    expect(runner.listRecovered()).toEqual([]);
  });
});
