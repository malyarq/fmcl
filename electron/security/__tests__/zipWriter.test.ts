import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { open as openZip } from 'yauzl';
import { SafeZipWriter } from '../zipWriter';

const tempDirs: string[] = [];

function listEntries(zipPath: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    openZip(zipPath, { lazyEntries: true }, (error, zip) => {
      if (error || !zip) return reject(error ?? new Error('ZIP did not open'));
      const entries: string[] = [];
      zip.on('entry', (entry) => {
        entries.push(entry.fileName);
        zip.readEntry();
      });
      zip.on('end', () => resolve(entries));
      zip.on('error', reject);
      zip.readEntry();
    });
  });
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe('SafeZipWriter', () => {
  it('streams files and buffers into a replaceable archive', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'burrow-zip-writer-'));
    tempDirs.push(root);
    const source = path.join(root, 'source.txt');
    const output = path.join(root, 'output.zip');
    fs.writeFileSync(source, 'source');
    fs.writeFileSync(output, 'old archive');

    const writer = new SafeZipWriter();
    writer.addFile('files/source.txt', source);
    writer.addBuffer('manifest.json', Buffer.from('{}'));
    await writer.writeTo(output);

    await expect(listEntries(output)).resolves.toEqual(['files/source.txt', 'manifest.json']);
  });

  it('rejects traversal entry names and symbolic-link sources', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'burrow-zip-writer-'));
    tempDirs.push(root);
    const source = path.join(root, 'source.txt');
    const link = path.join(root, 'source-link.txt');
    fs.writeFileSync(source, 'source');
    fs.symlinkSync(source, link);

    const writer = new SafeZipWriter();
    expect(() => writer.addBuffer('../escape', Buffer.alloc(0))).toThrow('stay inside');
    expect(() => writer.addFile('link.txt', link)).toThrow('regular file');
  });
});
