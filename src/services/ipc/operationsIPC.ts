import type {
  BurrowApi,
  OperationSnapshot,
  OperationStartRequest,
} from '@shared/contracts';
import { toIpcError } from './ipcError';

type OperationsApi = BurrowApi['operations'];

function api(): OperationsApi {
  const operations = typeof window !== 'undefined' ? window.api?.operations : undefined;
  if (!operations) throw new Error('[operationsIPC] operations API is not available');
  return operations;
}

async function call<T>(method: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    const ipcError = toIpcError({ namespace: 'operationsIPC', method }, error);
    console.error(ipcError);
    throw ipcError;
  }
}

export const operationsIPC = {
  isAvailable: () => typeof window !== 'undefined' && Boolean(window.api?.operations),
  start: (input: OperationStartRequest) => call('start', () => api().start(input)),
  get: (operationId: string) => call('get', () => api().get(operationId)),
  listRecovered: () => call('listRecovered', () => api().listRecovered()),
  cancel: (operationId: string) => call('cancel', () => api().cancel(operationId)),
  subscribe: (operationId: string, listener: (snapshot: OperationSnapshot) => void) => (
    call('subscribe', () => api().subscribe(operationId, listener))
  ),
};

export type OperationsIPC = typeof operationsIPC;
