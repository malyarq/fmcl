import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ZipFile } from 'yazl';
import { afterEach, describe, expect, it } from 'vitest';
import { extractZipSafely, openValidatedZip } from '../archivePolicy';

function centralDirectoryOffsets(buffer: Buffer): number[] {
  const offsets: number[] = [];
  for (let offset = 0; offset <= buffer.length - 4; offset += 1) {
    if (buffer.readUInt32LE(offset) === 0x02014b50) offsets.push(offset);
  }
  return offsets;
}

function createZipBuffer(entries: Array<[string, Buffer, boolean?]>): Promise<Buffer> {
  const zip = new ZipFile();
  const chunks: Buffer[] = [];
  const result = new Promise<Buffer>((resolve, reject) => {
    zip.outputStream.on('data', (chunk: Buffer) => chunks.push(chunk));
    zip.outputStream.on('error', reject);
    zip.outputStream.on('end', () => resolve(Buffer.concat(chunks)));
  });
  for (const [name, data, compress = true] of entries) zip.addBuffer(data, name, { compress });
  zip.end();
  return result;
}

describe('archivePolicy', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
  });

  it('rejects traversal entries before decompression', async () => {
    const buffer = await createZipBuffer([['xx/escape.txt', Buffer.from('blocked')]]);
    for (let offset = buffer.indexOf('xx/escape.txt'); offset !== -1; offset = buffer.indexOf('xx/escape.txt', offset + 1)) {
      buffer.write('../escape.txt', offset, 'utf8');
    }

    await expect(openValidatedZip(buffer, 'Test archive')).rejects.toThrow('invalid relative path');
  });

  it('rejects duplicate entry paths from central-directory metadata', async () => {
    const buffer = await createZipBuffer([
      ['same-a.txt', Buffer.from('first')],
      ['same-b.txt', Buffer.from('second')],
    ]);
    const [, secondOffset] = centralDirectoryOffsets(buffer);
    buffer.write('same-a.txt', secondOffset + 46, 'utf8');

    await expect(openValidatedZip(buffer, 'Test archive')).rejects.toThrow('duplicate entry');
  });

  it('rejects encrypted and symlink entries before decompression', async () => {
    const encryptedBuffer = await createZipBuffer([['safe.txt', Buffer.from('safe')]]);
    encryptedBuffer.writeUInt16LE(encryptedBuffer.readUInt16LE(centralDirectoryOffsets(encryptedBuffer)[0] + 8) | 1, centralDirectoryOffsets(encryptedBuffer)[0] + 8);
    await expect(openValidatedZip(encryptedBuffer, 'Test archive')).rejects.toThrow('Encrypted');

    const symlinkBuffer = await createZipBuffer([['link', Buffer.from('target')]]);
    symlinkBuffer.writeUInt32LE(0o120777 * 0x1_0000, centralDirectoryOffsets(symlinkBuffer)[0] + 38);
    await expect(openValidatedZip(symlinkBuffer, 'Test archive')).rejects.toThrow('symlinks');
  });

  it('enforces declared limits before opening entry streams', async () => {
    const buffer = await createZipBuffer([
      ['first.txt', Buffer.from('1234')],
      ['second.txt', Buffer.from('5678')],
    ]);

    await expect(openValidatedZip(buffer, 'Test archive', { maxTotalUncompressedBytes: 7 }))
      .rejects.toThrow('total uncompressed');
  });

  it('stops reading the central directory as soon as the entry limit is exceeded', async () => {
    const buffer = await createZipBuffer([
      ['first.txt', Buffer.from('1')],
      ['second.txt', Buffer.from('2')],
      ['third.txt', Buffer.from('3')],
    ]);

    await expect(openValidatedZip(buffer, 'Test archive', { maxEntries: 2 }))
      .rejects.toThrow('more than 2 entries');
  });

  it('requires a caller-specific limit before buffering entry data', async () => {
    const buffer = await createZipBuffer([['large-metadata.json', Buffer.alloc(32, 'x')]]);
    const validated = await openValidatedZip(buffer, 'Test archive');
    try {
      const entry = validated.getEntry('large-metadata.json');
      expect(entry).toBeDefined();
      await expect(validated.getData(entry!, 16)).rejects.toThrow('in-memory read limit');
    } finally {
      validated.close();
    }
  });

  it('enforces a byte limit while streaming malformed compressed data', async () => {
    const buffer = await createZipBuffer([['payload.txt', Buffer.alloc(64 * 1024, 'x')]]);
    const offset = centralDirectoryOffsets(buffer)[0];
    buffer.writeUInt32LE(1, offset + 24);

    const validated = await openValidatedZip(buffer, 'Test archive');
    try {
      const entry = validated.getEntry('payload.txt');
      expect(entry).toBeDefined();
      await expect(validated.getData(entry!, 128 * 1024)).rejects.toThrow();
    } finally {
      validated.close();
    }
  });

  it('rejects entry data whose CRC no longer matches the central directory', async () => {
    const buffer = await createZipBuffer([['payload.bin', Buffer.from('safe'), false]]);
    const payloadOffset = buffer.indexOf('safe');
    expect(payloadOffset).toBeGreaterThan(-1);
    buffer[payloadOffset] ^= 0xff;

    const validated = await openValidatedZip(buffer, 'Test archive');
    try {
      const entry = validated.getEntry('payload.bin');
      expect(entry).toBeDefined();
      await expect(validated.getData(entry!, 1024)).rejects.toThrow('checksum');
    } finally {
      validated.close();
    }
  });

  it('extracts validated entries inside the chosen directory', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fmcl-archive-'));
    tempDirs.push(root);
    const buffer = await createZipBuffer([['config/options.txt', Buffer.from('safe')]]);

    const validated = await openValidatedZip(buffer, 'Test archive');
    try {
      await extractZipSafely(validated, root);
    } finally {
      validated.close();
    }

    expect(fs.readFileSync(path.join(root, 'config', 'options.txt'), 'utf8')).toBe('safe');
  });
});
