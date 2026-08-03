import { ipcRenderer } from 'electron';
import type { ScreenshotsAPI } from '@shared/contracts/screenshots';

export const screenshots: ScreenshotsAPI = {
    list: (instancePath: string) => ipcRenderer.invoke('screenshots:list', instancePath),
    delete: (fileName: string, instancePath: string): Promise<{ ok: boolean }> => ipcRenderer.invoke('screenshots:delete', fileName, instancePath),
    rename: (oldName: string, newName: string, instancePath: string): Promise<{ ok: boolean }> => ipcRenderer.invoke('screenshots:rename', oldName, newName, instancePath),
    openFolder: (instancePath: string): Promise<{ ok: boolean }> => ipcRenderer.invoke('screenshots:openFolder', instancePath),
};
