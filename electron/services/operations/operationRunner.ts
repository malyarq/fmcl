import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import { OperationJournal } from './operationJournal';
import { OperationLocks } from './operationLocks';
import { RootMutationLock } from './rootMutationLock';
import { OperationRootRegistry } from './rootRegistry';
import { createRecoveryFailureSnapshot } from './recoveryFailureSnapshot';
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
  RootMutationCommandResult,
  RootMutationCoordinator,
  RootMutationCoordinatorFactory,
  RootMutationFailure,
  RootMutationPreparationResult,
} from './operationTypes';
import type { InstanceCommand, InstanceControlPlaneRead } from '../../domains/instances/instanceTypes';

export type OperationRunnerOptions = Readonly<{
  registryPath?: string;
  rootMutationLock?: RootMutationLock;
  rootMutationCoordinator?: RootMutationCoordinatorFactory;
}>;

type RootMutationScope = Readonly<{
  current?: InstanceControlPlaneRead;
  commit(command: InstanceCommand): Promise<RootMutationCommandResult>;
}>;

export class OperationRunner {
  private readonly adapters = new Map<OperationInput['kind'], OperationAdapter>();
  private readonly locks = new OperationLocks();
  private readonly rootMutationLock: RootMutationLock;
  private readonly rootMutationCoordinator?: RootMutationCoordinatorFactory;
  private readonly snapshots = new Map<string, OperationSnapshot>();
  private readonly completions = new Map<string, Promise<OperationSnapshot>>();
  private readonly listeners = new Map<string, Set<(snapshot: OperationSnapshot) => void>>();
  private readonly admittedWork = new Set<Promise<unknown>>();
  private acceptingMutations = true;
  private shutdownPromise?: Promise<void>;

  constructor(adapters: OperationAdapter[], options: OperationRunnerOptions = {}) {
    this.registry = options.registryPath ? new OperationRootRegistry(options.registryPath) : undefined;
    this.rootMutationLock = options.rootMutationLock ?? new RootMutationLock();
    this.rootMutationCoordinator = options.rootMutationCoordinator;
    for (const adapter of adapters) this.adapters.set(adapter.kind, adapter);
  }
  private readonly registry?: OperationRootRegistry;

  public async prepareRoot(rootPath: string): Promise<void> {
    this.assertAccepting();
    await this.track(this.runRootMutation(rootPath, async () => {
      this.registry?.register(rootPath);
    }));
  }

  /** A non-mutating canonical read. It intentionally bypasses the writer queue. */
  public async readControlPlane(rootPath: string): Promise<InstanceControlPlaneRead | RootMutationFailure> {
    const coordinator = this.coordinatorFor(rootPath);
    if (!coordinator) return rootMutationFailure('ROOT_MUTATION_COORDINATOR_UNAVAILABLE', 'Canonical control-plane coordinator is unavailable');
    try {
      return await coordinator.read();
    } catch (error) {
      return rootMutationFailure('ROOT_MUTATION_FAILED', toSafeMessage(error));
    }
  }

  /** Explicitly prepares canonical state while holding the root mutation scope. */
  public async prepareControlPlane(rootPath: string): Promise<RootMutationPreparationResult | RootMutationFailure> {
    this.assertAccepting();
    try {
      return await this.track(this.runRootMutation(rootPath, async (scope) => {
        if (!scope.coordinator) return rootMutationFailure('ROOT_MUTATION_COORDINATOR_UNAVAILABLE', 'Canonical control-plane coordinator is unavailable');
        if (scope.current?.status === 'ready') return { status: 'ready', source: 'canonical', snapshot: scope.current.snapshot };
        const prepared = await scope.coordinator.prepare();
        return prepared.status === 'recovery-required'
          ? rootMutationFailure('ROOT_MUTATION_PREPARE_FAILED', prepared.reason)
          : prepared;
      }));
    } catch (error) {
      return rootMutationFailure('ROOT_MUTATION_PREPARE_FAILED', toSafeMessage(error));
    }
  }

  /**
   * Executes one short canonical command in the same root scope as staged
   * operations. Only create may prepare legacy state; ordinary commands never
   * turn a read into a migration write.
   */
  public async commitControlPlane(rootPath: string, command: InstanceCommand): Promise<RootMutationCommandResult> {
    this.assertAccepting();
    try {
      return await this.track(this.runRootMutation(rootPath, async (scope) => await scope.commit(command)));
    } catch (error) {
      return rootMutationFailure('ROOT_MUTATION_FAILED', toSafeMessage(error));
    }
  }

  public async recoverRegistered(defaultRootPath: string): Promise<void> {
    // A clean installation has no launcher root yet. Recovery owns creating
    // the default root before the registry canonicalizes it with realpath.
    fs.mkdirSync(defaultRootPath, { recursive: true, mode: 0o700 });
    const canonicalDefaultRootPath = fs.realpathSync.native(defaultRootPath);
    this.registry?.register(canonicalDefaultRootPath);
    const listed = this.registry?.list() ?? { roots: [], errors: [] };
    for (const error of listed.errors) this.recordRecoveryFailure(canonicalDefaultRootPath, error);
    const roots = new Set([canonicalDefaultRootPath, ...listed.roots]);
    for (const rootPath of roots) {
      if (!fs.existsSync(rootPath)) continue;
      try { await this.recover(rootPath); } catch (error) {
        // One broken external root must not prevent the app's read-only UI.
        this.recordRecoveryFailure(rootPath, error);
      }
    }
  }

  public start(input: OperationInput): OperationSnapshot {
    this.assertAccepting();
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
          : input.kind === 'import-share' ? undefined : input.destinationId,
      status: 'queued',
      phase: 'started',
      progress: { completed: 0, total: 1 },
      createdAt: now,
      updatedAt: now,
      input: clone(input),
    };
    this.snapshots.set(snapshot.id, snapshot);
    const completion = this.track(Promise.resolve().then(() => this.runRootMutation(
      snapshot.rootPath,
      async (scope) => this.execute(adapter, snapshot.id, scope),
    )));
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
    this.assertAccepting();
    await this.runRootMutation(rootPath, async () => undefined);
  }

  /**
   * Permanently closes mutation admission and waits until every operation
   * admitted before the barrier has reached a durable terminal snapshot.
   */
  public beginShutdown(): Promise<void> {
    if (this.shutdownPromise) return this.shutdownPromise;
    this.acceptingMutations = false;
    for (const snapshot of this.snapshots.values()) {
      if (!isTerminal(snapshot)) this.cancel(snapshot.id);
    }
    this.shutdownPromise = this.drainAdmitted();
    return this.shutdownPromise;
  }

  public get isShuttingDown(): boolean { return !this.acceptingMutations; }

  private async recoverUnlocked(rootPath: string, scope?: RootMutationScope): Promise<void> {
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
      if (hasCanonicalRecoveryCommand(record) && (record.phase === 'published' || record.phase === 'control-plane-committed')) {
        const context = this.createContext(record, journal, scope);
        try {
          const result = await context.replayCanonicalCommand();
          if (result.status === 'recovered') {
            if (record.recovery && 'destinationId' in record.recovery) {
              workspace.removePublishMarker(this.destinationPath(record));
            }
            workspace.cleanupBackups();
          }
          this.finishRecovery(record, result);
        } catch {
          this.finishRecovery(record, { status: 'recovery-required', message: 'Published canonical command could not be replayed' });
        }
        continue;
      }
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

  private async execute(adapter: OperationAdapter, id: string, scope?: RootMutationScope): Promise<OperationSnapshot> {
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
    const context = this.createContext(snapshot, journal, scope);
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

  private createContext(snapshot: OperationSnapshot, journal: OperationJournal, scope?: RootMutationScope): OperationContext {
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
      recordCanonicalCommand: (command) => {
        snapshot.recovery = {
          ...(snapshot.recovery ?? {}),
          canonicalCommand: {
            version: 1,
            rootPath: snapshot.rootPath,
            operationId: snapshot.id,
            command: structuredClone(command),
          },
        } as typeof snapshot.recovery;
        snapshot.updatedAt = new Date().toISOString();
        journal.save(snapshot);
        this.notify(snapshot);
      },
      commitControlPlane: async (command) => {
        if (isCancelled(snapshot)) throw new Error('Operation cancelled');
        if (!scope) return rootMutationFailure('ROOT_MUTATION_COORDINATOR_UNAVAILABLE', 'Canonical control-plane scope is unavailable');
        const recorded = snapshot.recovery?.canonicalCommand;
        if (recorded && !sameJson(recorded.command, command)) {
          throw new Error('Canonical control-plane command differs from durable recovery command');
        }
        return await scope.commit(command);
      },
      replayCanonicalCommand: async () => {
        const command = snapshot.recovery?.canonicalCommand;
        if (!command) return { status: 'recovery-required', message: 'Canonical recovery command is missing' };
        if (!scope) return { status: 'recovery-required', message: 'Canonical control-plane scope is unavailable' };
        const result = await scope.commit(command.command);
        if ('code' in result) return { status: 'recovery-required', message: 'Canonical control-plane replay failed' };
        snapshot.phase = 'control-plane-committed';
        snapshot.updatedAt = new Date().toISOString();
        journal.save(snapshot);
        this.notify(snapshot);
        return { status: 'recovered', instanceId: canonicalCommandInstanceId(command.command, result) };
      },
    };
  }

  private async runRootMutation<T>(rootPath: string, work: (scope: RootMutationScope & { coordinator?: RootMutationCoordinator }) => Promise<T>): Promise<T> {
    return await this.locks.run(
      // Every mutation edits root-level control-plane files. Keep the local
      // queue root-wide, then reinforce it with the filesystem lock below.
      { rootPath },
      async () => await this.rootMutationLock.run(rootPath, async () => {
        const coordinator = this.coordinatorFor(rootPath);
        // Every contender must reread after the local queue and filesystem lock. This is also
        // what makes a second first-use caller observe a published migration.
        const current = coordinator ? await coordinator.read() : undefined;
        const scope: RootMutationScope & { coordinator?: RootMutationCoordinator } = {
          current,
          coordinator,
          commit: async (command) => {
            if (!coordinator) return rootMutationFailure('ROOT_MUTATION_COORDINATOR_UNAVAILABLE', 'Canonical control-plane coordinator is unavailable');
            if (command.type === 'create' && current?.status === 'uninitialized') {
              const prepared = await coordinator.prepare();
              if (prepared.status === 'recovery-required') {
                return rootMutationFailure('ROOT_MUTATION_PREPARE_FAILED', prepared.reason);
              }
            }
            try {
              return await coordinator.execute(command);
            } catch (error) {
              return rootMutationFailure('ROOT_MUTATION_FAILED', toSafeMessage(error));
            }
          },
        };
        await this.recoverUnlocked(rootPath, scope);
        return await work(scope);
      }),
    );
  }

  private coordinatorFor(rootPath: string): RootMutationCoordinator | undefined {
    return this.rootMutationCoordinator?.forRoot(rootPath);
  }

  private assertAccepting(): void {
    if (!this.acceptingMutations) throw new Error('Operation runner is shutting down');
  }

  private track<T>(work: Promise<T>): Promise<T> {
    this.admittedWork.add(work);
    void work.finally(() => this.admittedWork.delete(work)).catch(() => undefined);
    return work;
  }

  private async drainAdmitted(): Promise<void> {
    while (this.admittedWork.size > 0) {
      await Promise.allSettled([...this.admittedWork]);
    }
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
    const snapshot = createRecoveryFailureSnapshot(rootPath, error);
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

function hasCanonicalRecoveryCommand(snapshot: OperationSnapshot): boolean {
  return snapshot.recovery?.canonicalCommand !== undefined;
}

function canonicalCommandInstanceId(command: InstanceCommand, result: RootMutationCommandResult): string | undefined {
  if ('code' in result) return undefined;
  switch (command.type) {
    case 'commit-published':
    case 'reconcile-update':
      return command.record.id;
    case 'create':
      return result.snapshot.selectedId ?? undefined;
    default:
      return command.id;
  }
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function toSafeMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Operation failed';
}

function rootMutationFailure(code: RootMutationFailure['code'], message: string): RootMutationFailure {
  return { status: 'failed', code, message };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
