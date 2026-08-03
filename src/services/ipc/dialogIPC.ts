import { toIpcError } from './ipcError';
import type { DialogsAPI } from '@shared/contracts';

export type {
  OpenDialogResult,
  SaveDialogResult,
  ShowOpenDialogOptions,
  ShowSaveDialogOptions,
} from '@shared/contracts';

async function call<T>(methodName: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    const e = toIpcError({ namespace: 'dialogIPC', method: methodName }, err);
    console.error(e);
    throw e;
  }
}

export const dialogIPC: DialogsAPI = {
  showSaveDialog(options) {
    return call('showSaveDialog', () => window.api.dialogs.showSaveDialog(options));
  },

  showOpenDialog(options) {
    return call('showOpenDialog', () => window.api.dialogs.showOpenDialog(options));
  },

  getDesktopPath() {
    return call('getDesktopPath', () => window.api.dialogs.getDesktopPath());
  },

  saveFile(filePath, content) {
    return call('saveFile', () => window.api.dialogs.saveFile(filePath, content));
  },
};

export type DialogIPC = typeof dialogIPC;
