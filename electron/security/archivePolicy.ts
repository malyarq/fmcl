import fs from 'node:fs';
import path from 'node:path';
import { Transform, type Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import * as yauzl from 'yauzl';
import * as crc32Module from 'buffer-crc32';
import { assertAbsolutePath, assertRelativePath, resolvePathWithinRoot } from './pathGuards';

const crc32 = (
  'default' in crc32Module ? crc32Module.default : crc32Module
) as typeof import('buffer-crc32');

export type ArchivePolicy = {
  maxArchiveBytes?: number;
  maxEntries?: number;
  maxEntryUncompressedBytes?: number;
  maxTotalUncompressedBytes?: number;
  maxExpansionRatio?: number;
};

const DEFAULT_POLICY: Required<ArchivePolicy> = {
  maxArchiveBytes: 2 * 1024 * 1024 * 1024,
  maxEntries: 20_000,
  maxEntryUncompressedBytes: 512 * 1024 * 1024,
  maxTotalUncompressedBytes: 8 * 1024 * 1024 * 1024,
  maxExpansionRatio: 250,
};

export type ValidatedZipEntry = yauzl.Entry;

export interface ValidatedZip {
  getEntries(): readonly ValidatedZipEntry[];
  getEntry(entryName: string): ValidatedZipEntry | undefined;
  getData(entry: ValidatedZipEntry, maxBytes: number): Promise<Buffer>;
  openReadStream(entry: ValidatedZipEntry): Promise<Readable>;
  close(): void;
}

type YauzlOptions = yauzl.Options & { autoClose: boolean; lazyEntries: boolean };

function normalizeArchiveEntryName(entryName: string): string | null {
  const withoutTrailingSeparators = entryName.replace(/[\\/]+$/, '');
  if (!withoutTrailingSeparators) return null;
  return assertRelativePath(withoutTrailingSeparators, 'Archive entry path').split(path.sep).join('/');
}

function isUnixSymlink(entry: ValidatedZipEntry): boolean {
  const unixMode = (entry.externalFileAttributes >>> 16) & 0xffff;
  return (unixMode & 0xf000) === 0xa000;
}

function validateEntries(entries: readonly ValidatedZipEntry[], policyOverrides: ArchivePolicy = {}): void {
  const policy = { ...DEFAULT_POLICY, ...policyOverrides };
  if (entries.length > policy.maxEntries) {
    throw new Error(`Archive contains more than ${policy.maxEntries} entries`);
  }

  const seenNames = new Set<string>();
  let totalUncompressedBytes = 0;
  for (const entry of entries) {
    const normalizedName = normalizeArchiveEntryName(entry.fileName);
    if (normalizedName) {
      if (seenNames.has(normalizedName)) throw new Error(`Archive contains a duplicate entry: ${normalizedName}`);
      seenNames.add(normalizedName);
    }
    if (entry.isEncrypted()) throw new Error(`Encrypted archive entries are not supported: ${entry.fileName}`);
    if (isUnixSymlink(entry)) throw new Error(`Archive symlinks are not supported: ${entry.fileName}`);

    const uncompressedBytes = entry.uncompressedSize;
    const compressedBytes = entry.compressedSize;
    if (!Number.isSafeInteger(uncompressedBytes) || uncompressedBytes < 0
      || uncompressedBytes > policy.maxEntryUncompressedBytes) {
      throw new Error(`Archive entry is too large: ${entry.fileName}`);
    }
    if (!Number.isSafeInteger(compressedBytes) || compressedBytes < 0) {
      throw new Error(`Archive entry has an invalid compressed size: ${entry.fileName}`);
    }

    totalUncompressedBytes += uncompressedBytes;
    if (!Number.isSafeInteger(totalUncompressedBytes) || totalUncompressedBytes > policy.maxTotalUncompressedBytes) {
      throw new Error('Archive exceeds the total uncompressed size limit');
    }
    if (uncompressedBytes > 0 && (compressedBytes === 0 || uncompressedBytes / compressedBytes > policy.maxExpansionRatio)) {
      throw new Error(`Archive entry exceeds the allowed expansion ratio: ${entry.fileName}`);
    }
  }
}

function yauzlOptions(): YauzlOptions {
  return {
    autoClose: false,
    lazyEntries: true,
    validateEntrySizes: true,
    strictFileNames: true,
  };
}

function openZip(source: string | Buffer): Promise<yauzl.ZipFile> {
  return new Promise((resolve, reject) => {
    const done = (error: Error | null, zip: yauzl.ZipFile) => error ? reject(error) : resolve(zip);
    if (Buffer.isBuffer(source)) {
      yauzl.fromBuffer(source, yauzlOptions(), done);
    } else {
      yauzl.open(source, yauzlOptions(), done);
    }
  });
}

function readEntries(zip: yauzl.ZipFile, maxEntries: number): Promise<ValidatedZipEntry[]> {
  return new Promise((resolve, reject) => {
    const entries: ValidatedZipEntry[] = [];
    const onEntry = (entry: ValidatedZipEntry) => {
      if (entries.length >= maxEntries) {
        cleanup();
        zip.close();
        reject(new Error(`Archive contains more than ${maxEntries} entries`));
        return;
      }
      entries.push(entry);
      zip.readEntry();
    };
    const cleanup = () => {
      zip.removeListener('entry', onEntry);
      zip.removeListener('end', onEnd);
      zip.removeListener('error', onError);
    };
    const onEnd = () => {
      cleanup();
      resolve(entries);
    };
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };

    zip.on('entry', onEntry);
    zip.once('end', onEnd);
    zip.once('error', onError);
    zip.readEntry();
  });
}

function openEntryReadStream(zip: yauzl.ZipFile, entry: ValidatedZipEntry): Promise<Readable> {
  return new Promise((resolve, reject) => {
    zip.openReadStream(entry, (error, stream) => error ? reject(error) : resolve(stream));
  });
}

function entryVerifier(entry: ValidatedZipEntry, limit: number): Transform {
  let received = 0;
  let checksum: number | undefined;
  return new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      received += chunk.length;
      if (received > limit) {
        callback(new Error(`Archive entry exceeds the allowed uncompressed size while reading: ${entry.fileName}`));
        return;
      }
      checksum = crc32.unsigned(chunk, checksum);
      callback(null, chunk);
    },
    flush(callback) {
      if (received !== entry.uncompressedSize) {
        callback(new Error(`Archive entry size does not match metadata: ${entry.fileName}`));
        return;
      }
      if ((checksum ?? 0) !== (entry.crc32 >>> 0)) {
        callback(new Error(`Archive entry checksum does not match metadata: ${entry.fileName}`));
        return;
      }
      callback();
    },
  });
}

async function openVerifiedEntryReadStream(
  zip: yauzl.ZipFile,
  entry: ValidatedZipEntry,
  limit: number,
): Promise<Readable> {
  const input = await openEntryReadStream(zip, entry);
  const verifier = entryVerifier(entry, limit);
  input.on('error', (error) => verifier.destroy(error));
  return input.pipe(verifier);
}

async function readEntryData(
  zip: yauzl.ZipFile,
  entry: ValidatedZipEntry,
  policy: Required<ArchivePolicy>,
  maxBytes: number,
): Promise<Buffer> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) {
    throw new Error('Archive entry read limit must be a positive safe integer');
  }
  const readLimit = Math.min(maxBytes, policy.maxEntryUncompressedBytes);
  if (entry.uncompressedSize > readLimit) {
    throw new Error(`Archive entry exceeds the in-memory read limit: ${entry.fileName}`);
  }
  const chunks: Buffer[] = [];
  const collector = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      chunks.push(Buffer.from(chunk));
      callback();
    },
  });
  const stream = await openVerifiedEntryReadStream(zip, entry, readLimit);
  await pipeline(stream, collector);
  return Buffer.concat(chunks);
}

export function validateZipArchive(zip: ValidatedZip, policyOverrides: ArchivePolicy = {}): ValidatedZip {
  validateEntries(zip.getEntries(), policyOverrides);
  return zip;
}

export async function openValidatedZip(
  source: string | Buffer,
  label = 'Archive',
  policyOverrides: ArchivePolicy = {},
): Promise<ValidatedZip> {
  const policy = { ...DEFAULT_POLICY, ...policyOverrides };
  const archiveBytes = Buffer.isBuffer(source)
    ? source.length
    : (await fs.promises.stat(assertAbsolutePath(source, `${label} path`))).size;
  if (!Number.isSafeInteger(archiveBytes) || archiveBytes < 0 || archiveBytes > policy.maxArchiveBytes) {
    throw new Error(`${label} exceeds the compressed size limit`);
  }

  let rawZip: yauzl.ZipFile | undefined;
  try {
    rawZip = await openZip(source);
    const entries = await readEntries(rawZip, policy.maxEntries);
    validateEntries(entries, policy);
    const entryMap = new Map(entries.map((entry) => [entry.fileName, entry]));
    return {
      getEntries: () => entries,
      getEntry: (entryName) => entryMap.get(entryName),
      getData: (entry, maxBytes) => readEntryData(rawZip!, entry, policy, maxBytes),
      openReadStream: (entry) => openVerifiedEntryReadStream(rawZip!, entry, policy.maxEntryUncompressedBytes),
      close: () => rawZip?.close(),
    };
  } catch (error) {
    rawZip?.close();
    throw error;
  }
}

export async function extractZipSafely(zip: ValidatedZip, targetDirectory: string): Promise<void> {
  validateZipArchive(zip);
  const safeTargetDirectory = assertAbsolutePath(targetDirectory, 'Archive extraction directory');
  await fs.promises.mkdir(safeTargetDirectory, { recursive: true });

  for (const entry of zip.getEntries()) {
    const normalizedName = normalizeArchiveEntryName(entry.fileName);
    if (!normalizedName) continue;
    const targetPath = resolvePathWithinRoot(safeTargetDirectory, normalizedName, `Archive entry "${entry.fileName}"`);
    if (entry.fileName.endsWith('/')) {
      await fs.promises.mkdir(targetPath, { recursive: true });
      continue;
    }

    await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });
    const output = fs.createWriteStream(targetPath, { flags: 'wx' });
    try {
      const input = await zip.openReadStream(entry);
      await pipeline(input, output);
    } catch (error) {
      output.destroy();
      await fs.promises.rm(targetPath, { force: true });
      throw error;
    }
  }
}
