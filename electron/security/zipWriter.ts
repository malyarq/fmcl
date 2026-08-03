import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { randomUUID } from 'node:crypto';
import { ZipFile } from 'yazl';
import { assertAbsolutePath, assertRelativePath } from './pathGuards';

function normalizeEntryName(entryName: string): string {
  return assertRelativePath(entryName.replace(/\\/g, '/'), 'ZIP entry path')
    .split(path.sep)
    .join('/');
}

async function replaceFile(tempPath: string, outputPath: string): Promise<void> {
  if (!fs.existsSync(outputPath)) {
    await fs.promises.rename(tempPath, outputPath);
    return;
  }

  const backupPath = `${outputPath}.fmcl-backup-${randomUUID()}`;
  await fs.promises.rename(outputPath, backupPath);
  try {
    await fs.promises.rename(tempPath, outputPath);
  } catch (error) {
    await fs.promises.rename(backupPath, outputPath).catch(() => undefined);
    throw error;
  }
  await fs.promises.rm(backupPath, { force: true }).catch(() => undefined);
}

/** Streaming ZIP writer used for trusted local export and backup paths. */
export class SafeZipWriter {
  private readonly zip = new ZipFile();
  private ended = false;

  public addBuffer(entryName: string, data: Buffer): void {
    if (this.ended) throw new Error('ZIP writer is already closed');
    this.zip.addBuffer(data, normalizeEntryName(entryName));
  }

  public addFile(entryName: string, sourcePath: string): void {
    if (this.ended) throw new Error('ZIP writer is already closed');
    const safeSourcePath = assertAbsolutePath(sourcePath, 'ZIP source file');
    const stats = fs.lstatSync(safeSourcePath);
    if (!stats.isFile() || stats.isSymbolicLink()) {
      throw new Error(`ZIP source must be a regular file: ${safeSourcePath}`);
    }
    this.zip.addFile(safeSourcePath, normalizeEntryName(entryName));
  }

  public async writeTo(outputPath: string): Promise<void> {
    if (this.ended) throw new Error('ZIP writer is already closed');
    this.ended = true;

    const safeOutputPath = assertAbsolutePath(outputPath, 'ZIP output path');
    await fs.promises.mkdir(path.dirname(safeOutputPath), { recursive: true });
    const tempPath = `${safeOutputPath}.fmcl-write-${process.pid}-${randomUUID()}`;
    const writePromise = pipeline(
      this.zip.outputStream,
      fs.createWriteStream(tempPath, { flags: 'wx', mode: 0o600 }),
    );
    this.zip.end();

    try {
      await writePromise;
      await replaceFile(tempPath, safeOutputPath);
    } catch (error) {
      await fs.promises.rm(tempPath, { force: true }).catch(() => undefined);
      throw error;
    }
  }
}
