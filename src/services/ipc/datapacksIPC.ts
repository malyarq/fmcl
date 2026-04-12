// Use the preload bridge instead of importing ipcRenderer directly
const ipc = () => window.api.ipcRenderer;

export interface Datapack {
    fileName: string;
    name: string;
    description: string;
    isEnabled: boolean;
    path: string;
}

export const datapacksIPC = {
    list: (instancePath: string, worldFolder: string): Promise<Datapack[]> =>
        ipc().invoke('datapacks:list', instancePath, worldFolder),

    enable: (instancePath: string, worldFolder: string, fileName: string): Promise<{ ok: boolean }> =>
        ipc().invoke('datapacks:enable', instancePath, worldFolder, fileName),

    disable: (instancePath: string, worldFolder: string, fileName: string): Promise<{ ok: boolean }> =>
        ipc().invoke('datapacks:disable', instancePath, worldFolder, fileName),

    delete: (instancePath: string, worldFolder: string, fileName: string): Promise<{ ok: boolean }> =>
        ipc().invoke('datapacks:delete', instancePath, worldFolder, fileName),

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    search: (query: string, mcVersion?: string): Promise<any> =>
        ipc().invoke('datapacks:search', query, mcVersion),

    install: (instancePath: string, worldFolder: string, versionId: string): Promise<{ ok: boolean }> =>
        ipc().invoke('datapacks:install', instancePath, worldFolder, versionId),

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getVersions: (projectId: string): Promise<any[]> =>
        ipc().invoke('datapacks:getVersions', projectId),
};
