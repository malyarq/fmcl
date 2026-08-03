import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { OperationRootRegistry } from '../rootRegistry';

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
});
