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
    list: (instanceId: string) => call('list', () => api().list(instanceId)),
    delete: (fileName: string, instanceId: string) => call('delete', () => api().delete(fileName, instanceId)),
    rename: (oldName: string, newName: string, instanceId: string) => call('rename', () => api().rename(oldName, newName, instanceId)),
    openFolder: (instanceId: string) => call('openFolder', () => api().openFolder(instanceId)),
};
