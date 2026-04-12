import { ipcRenderer } from 'electron';
import type { Screenshot } from '../../services/screenshots/screenshotService';

export const ScreenshotsBridge = {
    list: (instancePath: string): Promise<Screenshot[]> => ipcRenderer.invoke('screenshots:list', instancePath),
    delete: (fileName: string, instancePath: string): Promise<{ ok: boolean }> => ipcRenderer.invoke('screenshots:delete', fileName, instancePath),
    rename: (oldName: string, newName: string, instancePath: string): Promise<{ ok: boolean }> => ipcRenderer.invoke('screenshots:rename', oldName, newName, instancePath),
    openFolder: (instancePath: string): Promise<{ ok: boolean }> => ipcRenderer.invoke('screenshots:openFolder', instancePath),
};
