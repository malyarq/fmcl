import { toIpcError } from './ipcError';

export interface ShowSaveDialogOptions {
  title?: string;
  defaultPath?: string;
  filters?: Array<{ name: string; extensions: string[] }>;
}

export interface ShowOpenDialogOptions {
  title?: string;
  filters?: Array<{ name: string; extensions: string[] }>;
  properties?: Array<'openFile' | 'openDirectory' | 'multiSelections'>;
}

export interface SaveDialogResult {
  canceled: boolean;
  filePath?: string;
}

export interface OpenDialogResult {
  canceled: boolean;
  filePaths: string[];
}

type IpcRendererApi = Window['api']['ipcRenderer'];

function getIpcRenderer(): IpcRendererApi | undefined {
  if (typeof window === 'undefined') return undefined;
  return window.api?.ipcRenderer;
}

function requireIpcRenderer(methodName: string): IpcRendererApi {
  const ipc = getIpcRenderer();
  if (!ipc) {
    throw new Error(`[dialogIPC] ipcRenderer is not available (method: ${methodName})`);
  }
  return ipc;
}

async function call<T>(methodName: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    const e = toIpcError({ namespace: 'dialogIPC', method: methodName }, err);
    console.error(e);
    throw e;
  }
}

export const dialogIPC = {
  showSaveDialog(options: ShowSaveDialogOptions): Promise<SaveDialogResult> {
    return call('showSaveDialog', () => 
      requireIpcRenderer('showSaveDialog').invoke<SaveDialogResult>('dialog:showSaveDialog', options)
    );
  },

  showOpenDialog(options: ShowOpenDialogOptions): Promise<OpenDialogResult> {
    return call('showOpenDialog', () => 
      requireIpcRenderer('showOpenDialog').invoke<OpenDialogResult>('dialog:showOpenDialog', options)
    );
  },
};

export type DialogIPC = typeof dialogIPC;
