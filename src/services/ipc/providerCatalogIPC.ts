import type { BurrowApi, ProviderCatalogSearchRequest, ProviderCatalogVersionsRequest } from '@shared/contracts';
import { toIpcError } from './ipcError';

type ProviderCatalogApi = BurrowApi['providerCatalog'];

function api(): ProviderCatalogApi {
  const providerCatalog = typeof window !== 'undefined' ? window.api?.providerCatalog : undefined;
  if (!providerCatalog) {
    throw new Error('[providerCatalogIPC] providerCatalog API is not available');
  }
  return providerCatalog;
}

async function call<T>(method: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    const ipcError = toIpcError({ namespace: 'providerCatalogIPC', method }, error);
    console.error(ipcError);
    throw ipcError;
  }
}

export const providerCatalogIPC = {
  isAvailable: () => typeof window !== 'undefined' && Boolean(window.api?.providerCatalog),
  search: (request: ProviderCatalogSearchRequest) => call('search', () => api().search(request)),
  versions: (request: ProviderCatalogVersionsRequest) => call('versions', () => api().versions(request)),
};

export type ProviderCatalogIPC = typeof providerCatalogIPC;
