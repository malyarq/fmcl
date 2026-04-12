import { Screenshot } from '../../../electron/services/screenshots/screenshotService';

const call = async <T>(method: string, fn: () => Promise<T>): Promise<T> => {
    if (!window.screenshots) {
        console.warn(`[ScreenshotsIPC] API not available (method: ${method})`);
        throw new Error('Screenshots API not available');
    }
    return fn();
};

export const screenshotsIPC = {
    list: (instancePath: string) => call('list', () => window.screenshots.list(instancePath)),
    delete: (fileName: string, instancePath: string) => call('delete', () => window.screenshots.delete(fileName, instancePath)),
    rename: (oldName: string, newName: string, instancePath: string) => call('rename', () => window.screenshots.rename(oldName, newName, instancePath)),
    openFolder: (instancePath: string) => call('openFolder', () => window.screenshots.openFolder(instancePath)),

    isAvailable: () => !!window.screenshots,
};

// Global type augmentation
declare global {
    interface Window {
        screenshots: {
            list: (instancePath: string) => Promise<Screenshot[]>;
            delete: (fileName: string, instancePath: string) => Promise<{ ok: boolean }>;
            rename: (oldName: string, newName: string, instancePath: string) => Promise<{ ok: boolean }>;
            openFolder: (instancePath: string) => Promise<{ ok: boolean }>;
        };
    }
}
