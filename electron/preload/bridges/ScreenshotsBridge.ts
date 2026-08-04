import { ipcRenderer } from 'electron';
import type { ScreenshotsAPI } from '@shared/contracts/screenshots';

export const screenshots: ScreenshotsAPI = {
    list: (instanceId: string) => ipcRenderer.invoke('screenshots:list', instanceId),
    delete: (fileName: string, instanceId: string): Promise<{ ok: boolean }> => ipcRenderer.invoke('screenshots:delete', fileName, instanceId),
    rename: (oldName: string, newName: string, instanceId: string): Promise<{ ok: boolean }> => ipcRenderer.invoke('screenshots:rename', oldName, newName, instanceId),
    openFolder: (instanceId: string): Promise<{ ok: boolean }> => ipcRenderer.invoke('screenshots:openFolder', instanceId),
};
