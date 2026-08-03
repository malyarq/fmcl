import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import { OperationJournal } from './operationJournal';
import { OperationLocks } from './operationLocks';
import { RootMutationLock } from './rootMutationLock';
import { OperationRootRegistry } from './rootRegistry';
import { StagingWorkspace } from './stagingWorkspace';
import { getModpackDir } from '../instances/paths';
import type {
  OperationAdapter,
  OperationContext,
  OperationInput,
  OperationPhase,
  OperationProgress,
  OperationResult,
  OperationSnapshot,
} from './operationTypes';

export class OperationRunner {
  private readonly adapters = new Map<OperationInput['kind'], OperationAdapter>();
  private readonly locks = new OperationLocks();
  private readonly rootMutationLock = new RootMutationLock();
  private readonly snapshots = new Map<string, OperationSnapshot>();
  private readonly completions = new Map<string, Promise<OperationSnapshot>>();
  private readonly listeners = new Map<string, Set<(snapshot: OperationSnapshot) => void>>();

  constructor(adapters: OperationAdapter[], options: { registryPath?: string } = {}) {
    this.registry = options.registryPath ? new OperationRootRegistry(options.registryPath) : undefined;
    for (const adapter of adapters) this.adapters.set(adapter.kind, adapter);
  }
  private readonly registry?: OperationRootRegistry;

  public async prepareRoot(rootPath: string): Promise<void> {
    await this.rootMutationLock.run(rootPath, async () => {
      this.registry?.register(rootPath);
      await this.recoverUnlocked(rootPath);
    });
  }

  public async recoverRegistered(defaultRootPath: string): Promise<void> {
    this.registry?.register(defaultRootPath);
    const listed = this.registry?.list() ?? { roots: [], errors: [] };
    for (const error of listed.errors) this.recordRecoveryFailure(defaultRootPath, error);
    const roots = new Set([defaultRootPath, ...listed.roots]);
    for (const rootPath of roots) {
      if (!fs.existsSync(rootPath)) continue;
      try { await this.recover(rootPath); } catch (error) {
        // One broken external root must not prevent the app's read-only UI.
        this.recordRecoveryFailure(rootPath, error);
      }
    }
  }

  public start(input: OperationInput): OperationSnapshot {
    const adapter = this.adapters.get(input.kind);
    if (!adapter) throw new Error(`No operation adapter registered for ${input.kind}`);
    const now = new Date().toISOString();
    const snapshot: OperationSnapshot = {
      id: randomUUID(),
      kind: input.kind,
      rootPath: input.rootPath,
      instanceId: input.kind === 'duplicate'
        ? input.sourceId
        : input.kind === 'update' || input.kind === 'delete' || input.kind === 'export'
          ? input.instanceId
          : input.destinationId,
      status: 'queued',
      phase: 'started',
      progress: { completed: 0, total: 1 },
      createdAt: now,
      updatedAt: now,
      input: clone(input),
    };
    this.snapshots.set(snapshot.id, snapshot);
    const completion = Promise.resolve().then(() => this.locks.run(
      // Every mutation edits root-level control-plane files. Keep the local
      // queue root-wide, then reinforce it with the filesystem lock below.
      { rootPath: snapshot.rootPath },
      async () => await this.rootMutationLock.run(snapshot.rootPath, async () => {
        await this.recoverUnlocked(snapshot.rootPath);
        return this.execute(adapter, snapshot.id);
      }),
    ));
    this.completions.set(snapshot.id, completion);
    return clone(snapshot);
  }

  public get(id: string): OperationSnapshot | undefined {
    const snapshot = this.snapshots.get(id);
    return snapshot ? clone(snapshot) : undefined;
  }

  public listRecovered(): OperationSnapshot[] {
    return [...this.snapshots.values()]
      .filter((snapshot) => snapshot.status === 'recovered' || snapshot.status === 'recovery-required')
      .map(clone);
  }

  public subscribe(id: string, listener: (snapshot: OperationSnapshot) => void): () => void {
    this.requireSnapshot(id);
    const listeners = this.listeners.get(id) ?? new Set<(snapshot: OperationSnapshot) => void>();
    listeners.add(listener);
    this.listeners.set(id, listeners);
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) this.listeners.delete(id);
    };
  }

  public async waitFor(id: string): Promise<OperationSnapshot> {
    const completion = this.completions.get(id);
    if (!completion) throw new Error(`Unknown operation: ${id}`);
    return clone(await completion);
  }

  public cancel(id: string): boolean {
    const snapshot = this.snapshots.get(id);
    if (!snapshot || isTerminal(snapshot)) return false;
    const wasQueued = snapshot.status === 'queued';
    snapshot.status = 'cancelling';
    snapshot.updatedAt = new Date().toISOString();
    if (!wasQueued) this.persist(snapshot);
    this.notify(snapshot);
    return true;
  }

  public async recover(rootPath: string): Promise<void> {
    await this.rootMutationLock.run(rootPath, async () => this.recoverUnlocked(rootPath));
  }

  private async recoverUnlocked(rootPath: string): Promise<void> {
    const journal = new OperationJournal(rootPath);
    for (const record of journal.list()) {
      if (isTerminal(record)) {
        this.snapshots.set(record.id, record);
        continue;
      }

      if (isArchiveExportRecovery(record)) {
        // The only authority for an archive output path is the one-time,
        // sender-bound native-save grant used when the operation starts. That
        // grant deliberately does not survive a restart, while the journal is
        // recoverable user-controlled state. Do not replay a journal-selected
        // external rename/remove after restart; retain the residue for manual
        // verification instead.
        this.snapshots.set(record.id, record);
        this.finishRecovery(record, {
          status: 'recovery-required',
          message: 'Archive export recovery requires manual verification',
        });
        continue;
      }

      const adapter = this.adapters.get(record.kind);
      const workspace = new StagingWorkspace(record.rootPath, record.id);
      this.snapshots.set(record.id, record);
      if (!adapter || !record.recovery) {
        if (adapter && record.phase === 'started') {
          // No adapter reaches a destructive rename before recording recovery
          // data; an old started-only record is therefore safe to close.
          workspace.cleanupStaging();
          this.finishRecovery(record, { status: 'recovered' });
          continue;
        }
        this.finishRecovery(record, { status: 'recovery-required', message: 'Operation recovery data is incomplete' });
        continue;
      }

      if ('outputPath' in record.recovery && ['started', 'staged', 'validated', 'publish-intent', 'backup-created', 'published'].includes(record.phase)) {
        const context = this.createContext(record, journal);
        try {
          this.finishRecovery(record, await adapter.recoverPublished?.(context) ?? { status: 'recovery-required', message: 'Archive recovery is unavailable' });
        } catch {
          this.finishRecovery(record, { status: 'recovery-required', message: 'Archive residue could not be verified' });
        }
        continue;
      }

      if (['started', 'staged', 'validated', 'publish-intent', 'backup-created'].includes(record.phase)) {
        const recovery = record.recovery;
        const destinationId = 'destinationId' in recovery ? recovery.destinationId : undefined;
        if ((record.phase === 'publish-intent' || record.phase === 'backup-created') && destinationId) {
          const restored = workspace.recoverUncommittedDestination(this.destinationPath(record), destinationId);
          if (!restored) {
            this.finishRecovery(record, { status: 'recovery-required', message: 'Operation publish residue cannot be proven safe' });
            continue;
          }
        }
        workspace.cleanupStaging();
        workspace.cleanupBackups();
        this.finishRecovery(record, { status: 'recovered' });
        continue;
      }

      if (record.phase === 'published' || record.phase === 'control-plane-committed') {
        const context = this.createContext(record, journal);
        try {
          const result = await adapter.recoverPublished?.(context) ?? {
            status: 'recovery-required' as const,
            message: 'Published operation cannot be safely completed',
          };
          if (result.status === 'recovered') workspace.cleanupBackups();
          this.finishRecovery(record, result);
        } catch {
          this.finishRecovery(record, { status: 'recovery-required', message: 'Published residue could not be verified' });
        }
        continue;
      }

      this.finishRecovery(record, { status: 'recovery-required', message: 'Unknown operation journal phase' });
    }
  }

  private async execute(adapter: OperationAdapter, id: string): Promise<OperationSnapshot> {
    const snapshot = this.requireSnapshot(id);
    if (isCancelled(snapshot)) {
      this.complete(snapshot, { status: 'cancelled' });
      return clone(snapshot);
    }
    snapshot.status = 'running';
    snapshot.updatedAt = new Date().toISOString();
    const journal = new OperationJournal(snapshot.rootPath);
    try {
      journal.save(snapshot);
    } catch {
      // Direct callers bypass the IPC request guard. Refuse to execute a
      // snapshot that cannot be durably validated instead of mutating files.
      this.complete(snapshot, { status: 'failed', code: 'OPERATION_FAILED', message: 'Operation request is invalid' }, false);
      return clone(snapshot);
    }
    this.notify(snapshot);
    const context = this.createContext(snapshot, journal);
    try {
      const result = await adapter.run(context);
      this.complete(snapshot, result);
    } catch (error) {
      this.complete(snapshot, isCancelled(snapshot)
        ? { status: 'cancelled' }
        : { status: 'failed', code: 'OPERATION_FAILED', message: toSafeMessage(error) });
    }
    return clone(snapshot);
  }

  private createContext(snapshot: OperationSnapshot, journal: OperationJournal): OperationContext {
    return {
      snapshot,
      isCancelled: () => isCancelled(snapshot),
      transition: (phase: OperationPhase, progress?: Partial<OperationProgress>) => {
        snapshot.phase = phase;
        snapshot.progress = { ...snapshot.progress, ...progress };
        snapshot.updatedAt = new Date().toISOString();
        journal.save(snapshot);
        this.notify(snapshot);
      },
      setRecoveryData: (recovery) => {
        snapshot.recovery = recovery;
        snapshot.updatedAt = new Date().toISOString();
        journal.save(snapshot);
        this.notify(snapshot);
      },
      setPublishIntent: (destinationId, destinationExisted, progress) => {
        snapshot.recovery = { ...(snapshot.recovery ?? {}), destinationId, publishIntent: { destinationId, destinationExisted } } as typeof snapshot.recovery;
        snapshot.phase = 'publish-intent';
        snapshot.progress = { ...snapshot.progress, ...progress };
        snapshot.updatedAt = new Date().toISOString();
        journal.save(snapshot);
        this.notify(snapshot);
      },
    };
  }

  private complete(snapshot: OperationSnapshot, result: OperationResult, persist = true): void {
    snapshot.result = result;
    snapshot.status = result.status;
    snapshot.phase = result.status === 'cancelled'
      ? 'cancelled'
      : result.status === 'failed'
        ? 'failed'
        : result.status === 'recovery-required'
          ? 'recovery-required'
          : 'completed';
    snapshot.updatedAt = new Date().toISOString();
    if (persist) this.persist(snapshot);
    this.notify(snapshot);
  }

  private finishRecovery(snapshot: OperationSnapshot, result: OperationResult): void {
    snapshot.result = result;
    snapshot.status = result.status;
    snapshot.phase = result.status === 'recovery-required' ? 'recovery-required' : 'completed';
    snapshot.updatedAt = new Date().toISOString();
    this.persist(snapshot);
    this.notify(snapshot);
  }

  private persist(snapshot: OperationSnapshot): void {
    new OperationJournal(snapshot.rootPath).save(snapshot);
  }

  private recordRecoveryFailure(rootPath: string, error: unknown): void {
    const now = new Date().toISOString();
    const snapshot: OperationSnapshot = {
      id: `recovery-${randomUUID()}`, kind: 'duplicate', rootPath, status: 'recovery-required', phase: 'recovery-required',
      progress: { completed: 0, total: 1 }, createdAt: now, updatedAt: now,
      input: { kind: 'duplicate', rootPath, sourceId: 'recovery' },
      result: { status: 'recovery-required', message: toSafeMessage(error) },
    };
    this.snapshots.set(snapshot.id, snapshot);
  }

  private destinationPath(snapshot: OperationSnapshot): string {
    const recovery = snapshot.recovery;
    return getModpackDir(snapshot.rootPath, recovery && 'destinationId' in recovery ? recovery.destinationId : 'missing');
  }

  private requireSnapshot(id: string): OperationSnapshot {
    const snapshot = this.snapshots.get(id);
    if (!snapshot) throw new Error(`Unknown operation: ${id}`);
    return snapshot;
  }

  private notify(snapshot: OperationSnapshot): void {
    for (const listener of this.listeners.get(snapshot.id) ?? []) listener(clone(snapshot));
    if (isTerminal(snapshot)) this.listeners.delete(snapshot.id);
  }
}

function isCancelled(snapshot: OperationSnapshot): boolean {
  return snapshot.status === 'cancelling';
}

function isTerminal(snapshot: OperationSnapshot): boolean {
  return ['succeeded', 'recovered', 'degraded', 'cancelled', 'failed', 'recovery-required'].includes(snapshot.status);
}

function isArchiveExportRecovery(snapshot: OperationSnapshot): boolean {
  return snapshot.kind === 'export'
    && snapshot.input.kind === 'export'
    && (snapshot.input.format === 'zip' || snapshot.input.format === 'multimc')
    && snapshot.recovery !== undefined
    && 'outputPath' in snapshot.recovery;
}

function toSafeMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Operation failed';
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
