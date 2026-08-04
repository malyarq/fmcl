import { ipcRenderer } from 'electron';
import { PROVIDER_CATALOG_CHANNELS, type ProviderCatalogAPI } from '@shared/contracts';

/** The dedicated renderer capability for remote provider discovery. */
export const providerCatalog: ProviderCatalogAPI = {
  search: (request) => ipcRenderer.invoke(PROVIDER_CATALOG_CHANNELS.search, request),
  versions: (request) => ipcRenderer.invoke(PROVIDER_CATALOG_CHANNELS.versions, request),
};
