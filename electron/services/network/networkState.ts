import type { NetworkDiagnostic, NetworkDiagnosticCode } from '../../../shared/contracts/network';

export type StateListener<T> = (snapshot: T) => void;

export class StatePublisher<T extends { revision: number }> {
  private readonly listeners = new Set<StateListener<T>>();

  constructor(private snapshot: T) {}

  public get(): T {
    return structuredClone(this.snapshot);
  }

  public publish(snapshot: Omit<T, 'revision'>): T {
    this.snapshot = { ...snapshot, revision: this.snapshot.revision + 1 } as T;
    const value = this.get();
    for (const listener of this.listeners) listener(value);
    return value;
  }

  public subscribe(listener: StateListener<T>): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

export class SerialQueue {
  private tail: Promise<void> = Promise.resolve();

  public run<T>(work: () => Promise<T>): Promise<T> {
    const result = this.tail.then(work, work);
    this.tail = result.then(() => undefined, () => undefined);
    return result;
  }
}

export function diagnostic(code: NetworkDiagnosticCode, fallback: string, _error?: unknown): NetworkDiagnostic {
  // Native dependency errors may contain addresses, paths or stack-derived
  // implementation details. Public diagnostics deliberately use reviewed copy.
  return { code, message: fallback.slice(0, 240) };
}
