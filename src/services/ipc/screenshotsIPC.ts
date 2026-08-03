import type { ScreenshotsAPI } from '@shared/contracts/screenshots';

const call = async <T>(method: string, fn: () => Promise<T>): Promise<T> => {
    try {
        return await fn();
    } catch (error) {
        throw new Error(`[ScreenshotsIPC] ${method} failed`, { cause: error });
    }
};

const api = (): ScreenshotsAPI => window.api.screenshots;

export const screenshotsIPC = {
    list: (instancePath: string) => call('list', () => api().list(instancePath)),
    delete: (fileName: string, instancePath: string) => call('delete', () => api().delete(fileName, instancePath)),
    rename: (oldName: string, newName: string, instancePath: string) => call('rename', () => api().rename(oldName, newName, instancePath)),
    openFolder: (instancePath: string) => call('openFolder', () => api().openFolder(instancePath)),
};
