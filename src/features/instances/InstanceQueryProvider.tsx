import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { ModpackConfig, ModpackListItem } from '../../contexts/instances/types';
import {
  fetchInstanceCatalog,
  fetchModpackConfig,
  saveModpackConfig,
} from '../../contexts/instances/services/instancesService';

export interface InstanceQueryError {
  code: string;
  message: string;
}

export type InstanceQueryState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'uninitialized' }
  | { status: 'ready'; data: T }
  | { status: 'error'; error: InstanceQueryError };

export interface SelectedInstance {
  id: string;
  snapshot: ModpackConfig;
}

type Listener = () => void;

export interface InstanceQueryStore {
  subscribe(listener: Listener): () => void;
  getListState(): InstanceQueryState<readonly ModpackListItem[]>;
  getSelectedIdState(): InstanceQueryState<string>;
  getInstanceState(id: string | null | undefined): InstanceQueryState<ModpackConfig>;
  retainInstance(id: string | null | undefined): () => void;
  mutateInstance(id: string, update: (current: ModpackConfig) => ModpackConfig): Promise<void>;
  invalidateInstance(id: string): Promise<void>;
  invalidateInstances(): Promise<void>;
}

const IDLE_STATE: InstanceQueryState<never> = { status: 'idle' };
const LOADING_STATE: InstanceQueryState<never> = { status: 'loading' };
const UNINITIALIZED_STATE: InstanceQueryState<never> = { status: 'uninitialized' };

const InstanceQueryContext = createContext<InstanceQueryStore | null>(null);

export function InstanceQueryProvider(props: { children: ReactNode }) {
  const [store] = useState(() => new CanonicalInstanceQueryStore());

  useEffect(() => store.start(), [store]);

  return (
    <InstanceQueryContext.Provider value={store}>
      {props.children}
    </InstanceQueryContext.Provider>
  );
}

// The accessor and provider intentionally share the private context boundary.
// eslint-disable-next-line react-refresh/only-export-components
export function useInstanceQueryProvider(): InstanceQueryStore {
  const store = useContext(InstanceQueryContext);
  if (store === null) {
    throw new Error('Instance query selectors require InstanceQueryProvider');
  }
  return store;
}

class CanonicalInstanceQueryStore implements InstanceQueryStore {
  private active = false;
  private listeners = new Set<Listener>();
  private listState: InstanceQueryState<readonly ModpackListItem[]> = IDLE_STATE;
  private selectedIdState: InstanceQueryState<string> = IDLE_STATE;
  private records = new Map<string, InstanceQueryState<ModpackConfig>>();
  private retainCounts = new Map<string, number>();
  private instanceGenerations = new Map<string, number>();
  private instanceRequests = new Map<string, {
    generation: number;
    invalidation: boolean;
    promise: Promise<void>;
  }>();
  private catalogGeneration = 0;
  private catalogRequest: {
    generation: number;
    invalidation: boolean;
    promise: Promise<void>;
  } | null = null;
  private mutationRevisions = new Map<string, number>();
  private mutationQueues = new Map<string, Promise<void>>();

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getListState = (): InstanceQueryState<readonly ModpackListItem[]> => this.listState;

  getSelectedIdState = (): InstanceQueryState<string> => this.selectedIdState;

  getInstanceState = (id: string | null | undefined): InstanceQueryState<ModpackConfig> => {
    if (!id) return IDLE_STATE;
    return this.records.get(id) ?? IDLE_STATE;
  };

  retainInstance = (id: string | null | undefined): (() => void) => {
    if (!id) return noop;

    this.retainCounts.set(id, (this.retainCounts.get(id) ?? 0) + 1);
    if (this.active && this.getInstanceState(id).status === 'idle') void this.loadInstance(id);

    let released = false;
    return () => {
      if (released) return;
      released = true;

      const nextCount = (this.retainCounts.get(id) ?? 1) - 1;
      if (nextCount > 0) {
        this.retainCounts.set(id, nextCount);
        return;
      }

      this.retainCounts.delete(id);
      this.advanceInstanceGeneration(id);
      this.instanceRequests.delete(id);
      if (this.records.delete(id)) this.emit();
    };
  };

  mutateInstance = (id: string, update: (current: ModpackConfig) => ModpackConfig): Promise<void> => {
    const current = this.records.get(id);
    if (current?.status !== 'ready') return Promise.resolve();

    const next = update(current.data);
    if (next.id !== id) {
      return Promise.reject(new Error('Instance config mutation cannot change its canonical ID'));
    }

    const revision = (this.mutationRevisions.get(id) ?? 0) + 1;
    this.mutationRevisions.set(id, revision);
    this.records.set(id, { status: 'ready', data: next });
    this.emit();

    const persist = async () => {
      try {
        await saveModpackConfig(next);
      } catch (error) {
        if (this.mutationRevisions.get(id) === revision) await this.invalidateInstance(id);
        throw error;
      }
      if (this.mutationRevisions.get(id) === revision) await this.invalidateInstance(id);
    };
    const previous = this.mutationQueues.get(id) ?? Promise.resolve();
    const queued = previous.then(persist, persist);
    this.mutationQueues.set(id, queued);
    void queued.then(
      () => this.clearMutationQueue(id, queued),
      () => this.clearMutationQueue(id, queued),
    );
    return queued;
  };

  invalidateInstance = async (id: string): Promise<void> => {
    const currentRequest = this.instanceRequests.get(id);
    if (currentRequest?.invalidation) return currentRequest.promise;

    this.advanceInstanceGeneration(id);
    this.instanceRequests.delete(id);

    if (!this.active || !this.retainCounts.has(id)) {
      if (this.records.delete(id)) this.emit();
      return;
    }

    if (this.getInstanceState(id).status !== 'ready') {
      this.records.set(id, LOADING_STATE);
      this.emit();
    }
    await this.loadInstance(id, true);
  };

  invalidateInstances = async (): Promise<void> => {
    const retainedIds = [...this.retainCounts.keys()];
    const catalog = this.catalogRequest?.invalidation
      ? this.catalogRequest.promise
      : this.loadFreshCatalog(true);
    const snapshots = retainedIds.map((id) => this.invalidateInstance(id));
    await Promise.all([catalog, ...snapshots]);
  };

  start = (): (() => void) => {
    this.active = true;
    const catalog = this.loadFreshCatalog();
    for (const id of this.retainCounts.keys()) void this.loadInstance(id);
    void catalog;

    return () => {
      this.active = false;
      this.catalogGeneration += 1;
      this.catalogRequest = null;
      const knownIds = new Set([...this.instanceGenerations.keys(), ...this.retainCounts.keys()]);
      for (const id of knownIds) this.advanceInstanceGeneration(id);
      this.instanceRequests.clear();
    };
  };

  private loadFreshCatalog(invalidation = false): Promise<void> {
    const generation = ++this.catalogGeneration;
    this.listState = LOADING_STATE;
    this.selectedIdState = LOADING_STATE;
    this.emit();

    const promise = fetchInstanceCatalog().then(
      ({ instances, selectedId }) => {
        if (!this.isCurrentCatalog(generation)) return;
        this.listState = { status: 'ready', data: instances };
        this.selectedIdState = selectedId === null
          ? UNINITIALIZED_STATE
          : { status: 'ready', data: selectedId };
        this.emit();
      },
      (error: unknown) => {
        if (!this.isCurrentCatalog(generation)) return;
        const queryError = normalizeQueryError(error);
        this.listState = { status: 'error', error: queryError };
        this.selectedIdState = { status: 'error', error: queryError };
        this.emit();
      },
    );

    this.catalogRequest = { generation, invalidation, promise };
    void promise.finally(() => {
      if (this.catalogRequest?.generation === generation) this.catalogRequest = null;
    });
    return promise;
  }

  private loadInstance(id: string, invalidation = false): Promise<void> {
    if (!this.active || !this.retainCounts.has(id)) return Promise.resolve();

    const generation = this.getInstanceGeneration(id);
    const currentRequest = this.instanceRequests.get(id);
    if (currentRequest?.generation === generation) return currentRequest.promise;

    if (this.getInstanceState(id).status !== 'loading'
      && !(invalidation && this.getInstanceState(id).status === 'ready')) {
      this.records.set(id, LOADING_STATE);
      this.emit();
    }

    const promise = fetchModpackConfig(id).then(
      (snapshot) => {
        if (!this.isCurrentInstance(id, generation)) return;
        this.records.set(id, { status: 'ready', data: snapshot });
        this.emit();
      },
      (error: unknown) => {
        if (!this.isCurrentInstance(id, generation)) return;
        this.records.set(id, { status: 'error', error: normalizeQueryError(error) });
        this.emit();
      },
    );

    this.instanceRequests.set(id, { generation, invalidation, promise });
    void promise.finally(() => {
      const current = this.instanceRequests.get(id);
      if (current?.generation === generation && current.promise === promise) this.instanceRequests.delete(id);
    });
    return promise;
  }

  private isCurrentCatalog(generation: number): boolean {
    return this.active && this.catalogGeneration === generation;
  }

  private isCurrentInstance(id: string, generation: number): boolean {
    return this.active
      && this.retainCounts.has(id)
      && this.getInstanceGeneration(id) === generation;
  }

  private getInstanceGeneration(id: string): number {
    return this.instanceGenerations.get(id) ?? 0;
  }

  private advanceInstanceGeneration(id: string): void {
    this.instanceGenerations.set(id, this.getInstanceGeneration(id) + 1);
  }

  private emit(): void {
    if (!this.active) return;
    for (const listener of this.listeners) listener();
  }

  private clearMutationQueue(id: string, queued: Promise<void>): void {
    if (this.mutationQueues.get(id) === queued) this.mutationQueues.delete(id);
  }
}

function normalizeQueryError(error: unknown): InstanceQueryError {
  if (error instanceof Error) {
    return {
      code: error.name === 'Error' ? 'INSTANCE_QUERY_FAILED' : error.name,
      message: error.message,
    };
  }
  return { code: 'INSTANCE_QUERY_FAILED', message: 'Instance query failed' };
}

function noop(): void {}
