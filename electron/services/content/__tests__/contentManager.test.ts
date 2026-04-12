import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ContentManager } from '../contentManager';

function createTempRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'fmcl-content-'));
}

function writeFile(filePath: string, contents: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents, 'utf-8');
}

describe('ContentManager', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    vi.restoreAllMocks();

    for (const dir of tempDirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('imports files into the sharded store and returns a stable hash', async () => {
    const rootDir = createTempRoot();
    tempDirs.push(rootDir);

    const sourcePath = path.join(rootDir, 'source.txt');
    writeFile(sourcePath, 'hello fmcl');

    const manager = new ContentManager(rootDir);

    const hash = await manager.importFile(sourcePath);
    const storePath = manager.getStorePath(hash);

    expect(hash).toMatch(/^[a-f0-9]{40}$/);
    expect(storePath).toBe(path.join(rootDir, 'content-store', hash.slice(0, 2), hash));
    expect(fs.readFileSync(storePath, 'utf-8')).toBe('hello fmcl');
  });

  it('falls back to copying when hard links cannot be created', async () => {
    const rootDir = createTempRoot();
    tempDirs.push(rootDir);

    const sourcePath = path.join(rootDir, 'source.txt');
    const destinationPath = path.join(rootDir, 'linked', 'copy.txt');
    writeFile(sourcePath, 'copy fallback');

    const manager = new ContentManager(rootDir);
    const hash = await manager.importFile(sourcePath);
    const linkSpy = vi.spyOn(fs, 'linkSync').mockImplementation(() => {
      throw new Error('cross-device');
    });

    await manager.linkFile(destinationPath, hash);

    expect(linkSpy).toHaveBeenCalledTimes(1);
    expect(fs.readFileSync(destinationPath, 'utf-8')).toBe('copy fallback');
  });

  it('deduplicates matching files and reports saved space in stats', async () => {
    const rootDir = createTempRoot();
    tempDirs.push(rootDir);

    const importedPath = path.join(rootDir, 'imported.txt');
    const duplicatePath = path.join(rootDir, 'mods', 'duplicate.txt');
    writeFile(importedPath, 'same-content');
    writeFile(duplicatePath, 'same-content');

    const manager = new ContentManager(rootDir);
    const hash = await manager.importFile(importedPath);

    const deduplicatedCount = await manager.deduplicateDirectory(path.join(rootDir, 'mods'));
    const stats = await manager.getStats();

    expect(deduplicatedCount).toBe(1);
    expect(stats.storedFiles).toBe(1);
    expect(stats.totalFiles).toBeGreaterThanOrEqual(2);
    expect(stats.dedupedSize).toBeGreaterThan(0);
    expect(fs.existsSync(manager.getStorePath(hash))).toBe(true);
    expect(fs.readFileSync(duplicatePath, 'utf-8')).toBe('same-content');
  });

  it('cleans up unused content-store files when they are old enough', async () => {
    const rootDir = createTempRoot();
    tempDirs.push(rootDir);

    const sourcePath = path.join(rootDir, 'unused.txt');
    writeFile(sourcePath, 'unused store content');

    const manager = new ContentManager(rootDir);
    const hash = await manager.importFile(sourcePath);
    const storePath = manager.getStorePath(hash);

    const result = await manager.cleanup(-1);

    expect(result.deletedFiles).toBe(1);
    expect(result.freedSize).toBe(Buffer.byteLength('unused store content'));
    expect(fs.existsSync(storePath)).toBe(false);
  });
});
