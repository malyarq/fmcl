import path from 'node:path';

export type OperationLockKey = {
  rootPath: string;
  instanceId?: string;
};

type PendingLock<T> = {
  key: NormalizedLockKey;
  work: () => Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
};

type NormalizedLockKey = {
  rootPath: string;
  instanceId?: string;
};

/** In-memory mutation lock. Reads deliberately never enter this queue. */
export class OperationLocks {
  private readonly active: NormalizedLockKey[] = [];
  private readonly pending: PendingLock<unknown>[] = [];

  public run<T>(key: OperationLockKey, work: () => Promise<T>): Promise<T> {
    const normalized = normalizeLockKey(key);
    return new Promise<T>((resolve, reject) => {
      this.pending.push({ key: normalized, work, resolve, reject } as PendingLock<unknown>);
      this.drain();
    });
  }

  private drain(): void {
    for (let index = 0; index < this.pending.length;) {
      const pending = this.pending[index];
      if (this.active.some((active) => conflicts(active, pending.key))) {
        index += 1;
        continue;
      }

      this.pending.splice(index, 1);
      this.active.push(pending.key);
      void pending.work().then(pending.resolve, pending.reject).finally(() => {
        const activeIndex = this.active.indexOf(pending.key);
        if (activeIndex >= 0) this.active.splice(activeIndex, 1);
        this.drain();
      });
    }
  }
}

function normalizeLockKey(key: OperationLockKey): NormalizedLockKey {
  const rootPath = path.resolve(key.rootPath);
  return {
    rootPath: process.platform === 'win32' ? rootPath.toLocaleLowerCase() : rootPath,
    instanceId: key.instanceId,
  };
}

function conflicts(left: NormalizedLockKey, right: NormalizedLockKey): boolean {
  if (left.rootPath !== right.rootPath) return false;
  return left.instanceId === undefined || right.instanceId === undefined || left.instanceId === right.instanceId;
}
