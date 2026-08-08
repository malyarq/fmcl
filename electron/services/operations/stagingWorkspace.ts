import fs from 'node:fs';
import path from 'node:path';
import { resolvePathWithinRoot } from '../../security/pathGuards';

export class StagingWorkspace {
  public readonly stagingRoot: string;
  public readonly backupRoot: string;

  constructor(rootPath: string, operationId: string) {
    this.stagingRoot = resolvePathWithinRoot(rootPath, `.burrow-operations/staging/${operationId}`, 'Operation staging directory');
    this.backupRoot = resolvePathWithinRoot(rootPath, `.burrow-operations/backups/${operationId}`, 'Operation backup directory');
  }

  public stagedModpack(destinationId: string): string {
    return resolvePathWithinRoot(this.stagingRoot, `modpacks/${destinationId}`, 'Staged modpack directory');
  }

  public backupModpack(destinationId: string): string {
    return resolvePathWithinRoot(this.backupRoot, `modpacks/${destinationId}`, 'Operation backup modpack directory');
  }

  public stageCopy(sourcePath: string, destinationId: string): string {
    const destination = this.stagedModpack(destinationId);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.cpSync(sourcePath, destination, { recursive: true, force: false, errorOnExist: true });
    this.markStaged(destination);
    return destination;
  }

  /** Attach an operation-owned marker before the staged directory can be renamed live. */
  public markStaged(destinationPath: string): void {
    fs.writeFileSync(path.join(destinationPath, '.burrow-operation-publish.json'), JSON.stringify({ operationId: path.basename(this.stagingRoot) }), { mode: 0o600 });
    fsyncDirectory(destinationPath);
  }

  public createBackup(destinationPath: string, destinationId: string): boolean {
    const backupPath = this.backupModpack(destinationId);
    if (!fs.existsSync(destinationPath)) return false;
    fs.mkdirSync(path.dirname(backupPath), { recursive: true });
    fs.renameSync(destinationPath, backupPath);
    fsyncDirectory(path.dirname(destinationPath));
    fsyncDirectory(path.dirname(backupPath));
    return true;
  }

  public publish(destinationPath: string, destinationId: string): void {
    const stagedPath = this.stagedModpack(destinationId);
    const backupPath = this.backupModpack(destinationId);
    try {
      fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
      fs.renameSync(stagedPath, destinationPath);
      fsyncDirectory(path.dirname(stagedPath));
      fsyncDirectory(path.dirname(destinationPath));
    } catch (error) {
      if (fs.existsSync(backupPath) && !fs.existsSync(destinationPath)) {
        fs.renameSync(backupPath, destinationPath);
        fsyncDirectory(path.dirname(backupPath));
        fsyncDirectory(path.dirname(destinationPath));
      }
      throw error;
    }
  }

  public restoreDestination(destinationPath: string, destinationId: string): boolean {
    const backupPath = this.backupModpack(destinationId);
    if (!fs.existsSync(backupPath)) return false;
    if (fs.existsSync(destinationPath)) {
      if (!this.isOwnedPublishedDestination(destinationPath)) return false;
      fs.rmSync(destinationPath, { recursive: true, force: true });
    }
    fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
    fs.renameSync(backupPath, destinationPath);
    fsyncDirectory(path.dirname(backupPath));
    fsyncDirectory(path.dirname(destinationPath));
    return true;
  }

  /**
   * Undo a destination swap only when the live directory still proves it was
   * published by this operation. Ambiguous bytes are deliberately preserved.
   */
  public recoverUncommittedDestination(destinationPath: string, destinationId: string): boolean {
    const backupPath = this.backupModpack(destinationId);
    const stagedPath = this.stagedModpack(destinationId);
    if (fs.existsSync(backupPath) && !fs.existsSync(destinationPath)) {
      return this.restoreDestination(destinationPath, destinationId);
    }
    if (fs.existsSync(backupPath) && fs.existsSync(destinationPath) && this.isOwnedPublishedDestination(destinationPath)) {
      fs.rmSync(destinationPath, { recursive: true, force: true });
      fs.renameSync(backupPath, destinationPath);
      fsyncDirectory(path.dirname(backupPath));
      fsyncDirectory(path.dirname(destinationPath));
      return true;
    }
    if (!fs.existsSync(backupPath) && fs.existsSync(stagedPath)) return true;
    // A brand new destination is safe to remove only when it carries our marker.
    if (!fs.existsSync(backupPath) && fs.existsSync(destinationPath) && this.isOwnedPublishedDestination(destinationPath)) {
      fs.rmSync(destinationPath, { recursive: true, force: true });
      return true;
    }
    return false;
  }

  public removePublishMarker(destinationPath: string): void {
    fs.rmSync(path.join(destinationPath, '.burrow-operation-publish.json'), { force: true });
  }

  private isOwnedPublishedDestination(destinationPath: string): boolean {
    try {
      const marker = JSON.parse(fs.readFileSync(path.join(destinationPath, '.burrow-operation-publish.json'), 'utf8')) as { operationId?: unknown };
      return marker.operationId === path.basename(this.stagingRoot);
    } catch {
      return false;
    }
  }

  public cleanupStaging(): void {
    fs.rmSync(this.stagingRoot, { recursive: true, force: true });
  }

  public cleanupBackups(): void {
    fs.rmSync(this.backupRoot, { recursive: true, force: true });
  }
}

function fsyncDirectory(directory: string): void {
  try {
    const descriptor = fs.openSync(directory, 'r');
    try { fs.fsyncSync(descriptor); } finally { fs.closeSync(descriptor); }
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (!['EINVAL', 'ENOTSUP', 'EPERM', 'EISDIR'].includes(code ?? '')) throw error;
  }
}
