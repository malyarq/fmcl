// Use the preload bridge instead of importing ipcRenderer directly
const ipc = () => window.api.ipcRenderer;

export interface Datapack {
    fileName: string;
    name: string;
    description: string;
    isEnabled: boolean;
    path: string;
}

export interface DatapackSearchResultItem {
    project_id: string;
    title: string;
    description: string;
    icon_url?: string | null;
}

export interface DatapackSearchResult {
    hits: DatapackSearchResultItem[];
    total_hits: number;
}

export interface DatapackVersion {
    id: string;
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

    search: (query: string, mcVersion?: string): Promise<DatapackSearchResult> =>
        ipc().invoke('datapacks:search', query, mcVersion),

    install: (instancePath: string, worldFolder: string, versionId: string): Promise<{ ok: boolean }> =>
        ipc().invoke('datapacks:install', instancePath, worldFolder, versionId),

    getVersions: (projectId: string): Promise<DatapackVersion[]> =>
        ipc().invoke('datapacks:getVersions', projectId),
};
