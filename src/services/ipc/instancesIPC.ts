import type {
  BurrowApi,
  InstanceConfigRequest,
  InstanceCreateRequest,
  InstanceMetadataRequest,
  InstanceMetadataUpdate,
  InstanceMetadataResponse,
  InstanceMutationResponse,
  InstanceResult,
  InstanceRenameRequest,
  InstanceSelectRequest,
  InstanceSnapshotRequest,
} from '@shared/contracts';
import { toIpcError } from './ipcError';

type InstancesApi = BurrowApi['instances'];

function api(): InstancesApi {
  const instances = typeof window !== 'undefined' ? window.api?.instances : undefined;
  if (!instances) throw new Error('[instancesIPC] instances API is not available');
  return instances;
}

async function call<T>(method: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    const ipcError = toIpcError({ namespace: 'instancesIPC', method }, error);
    console.error(ipcError);
    throw ipcError;
  }
}

export const instancesIPC = {
  isAvailable: () => typeof window !== 'undefined' && Boolean(window.api?.instances),
  list: () => call('list', () => api().list()),
  snapshot: (request: InstanceSnapshotRequest) => call('snapshot', () => api().snapshot(request)),
  select: (request: InstanceSelectRequest) => call('select', () => api().select(request)),
  create: (request: InstanceCreateRequest) => call('create', () => api().create(request)),
  rename: (request: InstanceRenameRequest) => call('rename', () => api().rename(request)),
  config: (request: InstanceConfigRequest) => call('config', () => api().config(request)),
  metadata: (request: Extract<InstanceMetadataRequest, { id: string; action?: never }>) => call<InstanceResult<InstanceMetadataResponse>>(
    'metadata',
    () => api().metadata(request) as Promise<InstanceResult<InstanceMetadataResponse>>,
  ),
  updateMetadata: (id: string, metadata: InstanceMetadataUpdate) => call(
    'updateMetadata',
    () => api().metadata({ action: 'save', id, metadata }) as Promise<InstanceResult<InstanceMutationResponse>>,
  ),
  prepare: () => call('prepare', () => api().prepare()),
};

export type InstancesIPC = typeof instancesIPC;
