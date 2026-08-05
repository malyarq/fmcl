import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const SCHEMA_VERSION_FIELD = '_fmclSchemaVersion';

export type AtomicJsonRead<T> = {
  value: T;
  source: 'primary' | 'backup';
  legacy: boolean;
};

export type AtomicJsonStoreErrorCode =
  | 'CORRUPT_STATE'
  | 'UNSUPPORTED_VERSION'
  | 'WRITE_CONFLICT'
  | 'WRITE_FAILED';

export class AtomicJsonStoreError extends Error {
  public readonly code: AtomicJsonStoreErrorCode;
  public readonly filePath: string;

  constructor(code: AtomicJsonStoreErrorCode, filePath: string, message: string, cause?: unknown) {
    super(message, { cause });
    this.name = 'AtomicJsonStoreError';
    this.code = code;
    this.filePath = filePath;
  }
}

type AtomicJsonStoreOptions<T> = {
  version: number;
  mode?: number;
  validate?: (value: unknown) => value is T;
  /** Test-only fault seams for deterministic publication-boundary coverage. */
  faultHooks?: Partial<{
    beforeTempWrite: () => void;
    beforeBackupPublish: () => void;
    beforePrimaryPublish: () => void;
  }>;
};

type ParsedDocument<T> = {
  value: T;
  legacy: boolean;
};

export function getAtomicJsonBackupPath(filePath: string): string {
  return `${filePath}.bak`;
}

/**
 * Synchronous on purpose: the existing state services are synchronous and the
 * files are small. All writes are staged in the destination directory, fsynced,
 * and published with rename so a crash cannot expose a half-written JSON file.
 */
export class AtomicJsonStore<T extends object> {
  private readonly filePath: string;
  private readonly backupPath: string;
  private readonly version: number;
  private readonly mode: number;
  private readonly validate?: (value: unknown) => value is T;
  private readonly faultHooks?: AtomicJsonStoreOptions<T>['faultHooks'];

  constructor(filePath: string, options: AtomicJsonStoreOptions<T>) {
    this.filePath = filePath;
    this.backupPath = getAtomicJsonBackupPath(filePath);
    this.version = options.version;
    this.mode = options.mode ?? 0o600;
    this.validate = options.validate;
    this.faultHooks = options.faultHooks;
  }

  public read(): AtomicJsonRead<T> | null {
    if (fs.existsSync(this.filePath)) {
      try {
        const parsed = this.readPath(this.filePath);
        return { ...parsed, source: 'primary' };
      } catch (error) {
        if (error instanceof AtomicJsonStoreError && error.code === 'UNSUPPORTED_VERSION') {
          throw error;
        }
        return this.readBackupAfterPrimaryFailure(error);
      }
    }

    if (fs.existsSync(this.backupPath)) {
      try {
        const parsed = this.readPath(this.backupPath);
        return { ...parsed, source: 'backup' };
      } catch (error) {
        throw this.corruptStateError(error);
      }
    }

    return null;
  }

  public write(value: T): void {
    if (this.validate && !this.validate(value)) {
      throw new AtomicJsonStoreError(
        'WRITE_FAILED',
        this.filePath,
        `State does not match the expected schema: ${this.filePath}`,
      );
    }

    const directory = path.dirname(this.filePath);
    fs.mkdirSync(directory, { recursive: true });

    const tempPath = path.join(directory, `.${path.basename(this.filePath)}.${randomUUID()}.tmp`);
    const backupTempPath = path.join(directory, `.${path.basename(this.backupPath)}.${randomUUID()}.tmp`);

    try {
      this.faultHooks?.beforeTempWrite?.();
      this.writeAndSync(tempPath, this.serialize(value));

      if (fs.existsSync(this.filePath)) {
        try {
          this.readPath(this.filePath);
        } catch (error) {
          if (error instanceof AtomicJsonStoreError && error.code === 'UNSUPPORTED_VERSION') {
            throw new AtomicJsonStoreError(
              'WRITE_CONFLICT',
              this.filePath,
              `Refusing to overwrite unsupported state: ${this.filePath}`,
              error,
            );
          }
          this.requireValidBackupForRecovery(error);
          this.preserveCorruptPrimary();
        }

        if (this.isReadablePrimary()) {
          fs.copyFileSync(this.filePath, backupTempPath);
          this.syncFile(backupTempPath);
          fs.chmodSync(backupTempPath, this.mode);
          this.faultHooks?.beforeBackupPublish?.();
          fs.renameSync(backupTempPath, this.backupPath);
        }
      }

      this.faultHooks?.beforePrimaryPublish?.();
      fs.renameSync(tempPath, this.filePath);
      fs.chmodSync(this.filePath, this.mode);
      this.syncDirectory(directory);
    } catch (error) {
      this.removeTemp(tempPath);
      this.removeTemp(backupTempPath);
      if (error instanceof AtomicJsonStoreError) throw error;
      throw new AtomicJsonStoreError(
        'WRITE_FAILED',
        this.filePath,
        `Failed to atomically write state: ${this.filePath}`,
        error,
      );
    }
  }

  private readBackupAfterPrimaryFailure(primaryError: unknown): AtomicJsonRead<T> {
    if (fs.existsSync(this.backupPath)) {
      try {
        const parsed = this.readPath(this.backupPath);
        return { ...parsed, source: 'backup' };
      } catch (backupError) {
        throw this.corruptStateError(new AggregateError(
          [primaryError, backupError],
          'Primary and backup state are unreadable',
        ));
      }
    }

    throw this.corruptStateError(primaryError);
  }

  private isReadablePrimary(): boolean {
    try {
      this.readPath(this.filePath);
      return true;
    } catch {
      return false;
    }
  }

  private requireValidBackupForRecovery(primaryError: unknown): void {
    if (fs.existsSync(this.backupPath)) {
      try {
        this.readPath(this.backupPath);
        return;
      } catch (backupError) {
        throw new AtomicJsonStoreError(
          'WRITE_CONFLICT',
          this.filePath,
          `Refusing to overwrite state without a valid recovery backup: ${this.filePath}`,
          new AggregateError([primaryError, backupError]),
        );
      }
    }

    throw new AtomicJsonStoreError(
      'WRITE_CONFLICT',
      this.filePath,
      `Refusing to overwrite unreadable state without a recovery backup: ${this.filePath}`,
      primaryError,
    );
  }

  private preserveCorruptPrimary(): void {
    const basePath = `${this.filePath}.corrupt`;
    const recoveryPath = fs.existsSync(basePath) ? `${basePath}-${randomUUID()}` : basePath;
    fs.copyFileSync(this.filePath, recoveryPath, fs.constants.COPYFILE_EXCL);
    this.syncFile(recoveryPath);
    fs.chmodSync(recoveryPath, this.mode);
  }

  private readPath(candidate: string): ParsedDocument<T> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(fs.readFileSync(candidate, 'utf8'));
    } catch (error) {
      throw new AtomicJsonStoreError(
        'CORRUPT_STATE',
        candidate,
        `State is not readable JSON: ${candidate}`,
        error,
      );
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new AtomicJsonStoreError(
        'CORRUPT_STATE',
        candidate,
        `State must be a JSON object: ${candidate}`,
      );
    }

    const document = parsed as Record<string, unknown>;
    const storedVersion = document[SCHEMA_VERSION_FIELD];
    if (storedVersion !== undefined && storedVersion !== this.version) {
      throw new AtomicJsonStoreError(
        'UNSUPPORTED_VERSION',
        candidate,
        `Unsupported state schema version ${String(storedVersion)} in ${candidate}; expected ${this.version}`,
      );
    }

    const value = { ...document };
    delete value[SCHEMA_VERSION_FIELD];
    if (this.validate && !this.validate(value)) {
      throw new AtomicJsonStoreError(
        'CORRUPT_STATE',
        candidate,
        `State does not match the expected schema: ${candidate}`,
      );
    }

    return { value: value as T, legacy: storedVersion === undefined };
  }

  private serialize(value: T): string {
    return `${JSON.stringify({ ...value, [SCHEMA_VERSION_FIELD]: this.version }, null, 2)}\n`;
  }

  private writeAndSync(candidate: string, contents: string): void {
    const fd = fs.openSync(candidate, 'wx', this.mode);
    try {
      fs.writeFileSync(fd, contents, 'utf8');
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
  }

  private syncFile(candidate: string): void {
    const fd = fs.openSync(candidate, 'r');
    try {
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
  }

  private syncDirectory(directory: string): void {
    let fd: number | undefined;
    try {
      fd = fs.openSync(directory, 'r');
      fs.fsyncSync(fd);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (process.platform !== 'win32' && code !== 'EINVAL' && code !== 'ENOTSUP') {
        throw error;
      }
    } finally {
      if (fd !== undefined) fs.closeSync(fd);
    }
  }

  private removeTemp(candidate: string): void {
    try {
      fs.rmSync(candidate, { force: true });
    } catch {
      // A stale hidden temp is safer than touching the published state.
    }
  }

  private corruptStateError(cause: unknown): AtomicJsonStoreError {
    return new AtomicJsonStoreError(
      'CORRUPT_STATE',
      this.filePath,
      `State and recovery backup are unavailable: ${this.filePath}`,
      cause,
    );
  }
}
