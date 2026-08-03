import { ipcRenderer, type IpcRendererEvent } from 'electron';
import type { OperationSnapshot, OperationsAPI } from '@shared/contracts';

export const operations: OperationsAPI = {
  start: (input) => ipcRenderer.invoke('operations:start', input),
  get: (operationId) => ipcRenderer.invoke('operations:get', operationId),
  listRecovered: () => ipcRenderer.invoke('operations:listRecovered'),
  cancel: (operationId) => ipcRenderer.invoke('operations:cancel', operationId),
  subscribe: async (operationId, listener) => {
    const handler = (_event: IpcRendererEvent, snapshot: OperationSnapshot) => {
      if (snapshot.id === operationId) listener(snapshot);
    };
    ipcRenderer.on('operations:update', handler);
    try {
      await ipcRenderer.invoke('operations:subscribe', operationId);
    } catch (error) {
      ipcRenderer.removeListener('operations:update', handler);
      throw error;
    }
    return () => {
      ipcRenderer.removeListener('operations:update', handler);
      ipcRenderer.send('operations:unsubscribe', operationId);
    };
  },
};
