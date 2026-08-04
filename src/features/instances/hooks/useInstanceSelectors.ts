import { useEffect, useMemo, useSyncExternalStore } from 'react';
import type { ModpackConfig, ModpackListItem } from '../../../contexts/instances/types';
import {
  useInstanceQueryProvider,
} from '../InstanceQueryProvider';
import type {
  InstanceQueryState,
  SelectedInstance,
} from '../InstanceQueryProvider';

const IDLE_STATE: InstanceQueryState<never> = { status: 'idle' };
const LOADING_STATE: InstanceQueryState<never> = { status: 'loading' };
const UNINITIALIZED_STATE: InstanceQueryState<never> = { status: 'uninitialized' };

export function useInstanceList(): InstanceQueryState<readonly ModpackListItem[]> {
  const store = useInstanceQueryProvider();
  return useSyncExternalStore(store.subscribe, store.getListState, store.getListState);
}

export function useSelectedInstanceId(): InstanceQueryState<string> {
  const store = useInstanceQueryProvider();
  return useSyncExternalStore(
    store.subscribe,
    store.getSelectedIdState,
    store.getSelectedIdState,
  );
}

export function useInstanceSnapshot(
  id: string | null | undefined,
): InstanceQueryState<ModpackConfig> {
  const store = useInstanceQueryProvider();

  useEffect(() => store.retainInstance(id), [id, store]);

  return useSyncExternalStore(
    store.subscribe,
    () => store.getInstanceState(id),
    () => store.getInstanceState(id),
  );
}

export function useSelectedInstance(): InstanceQueryState<SelectedInstance> {
  const selectedId = useSelectedInstanceId();
  const snapshot = useInstanceSnapshot(selectedId.status === 'ready' ? selectedId.data : null);

  return useMemo(() => {
    if (selectedId.status === 'idle') return IDLE_STATE;
    if (selectedId.status === 'loading') return LOADING_STATE;
    if (selectedId.status === 'uninitialized') return UNINITIALIZED_STATE;
    if (selectedId.status === 'error') return selectedId;

    if (snapshot.status === 'idle' || snapshot.status === 'loading') return LOADING_STATE;
    if (snapshot.status === 'uninitialized') return UNINITIALIZED_STATE;
    if (snapshot.status === 'error') return snapshot;
    return { status: 'ready', data: { id: selectedId.data, snapshot: snapshot.data } };
  }, [selectedId, snapshot]);
}
