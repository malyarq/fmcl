import type { ResourcePacksAPI } from '../../../shared/contracts/resourcePacks';

function getLegacyResourcePacksApi(): ResourcePacksAPI {
    const ipc = window.api.ipcRenderer;

    return {
        list: (instancePath) => ipc.invoke('resourcePacks:list', instancePath),
        enable: (fileName, instancePath) => ipc.invoke('resourcePacks:enable', fileName, instancePath),
        disable: (fileName, instancePath) => ipc.invoke('resourcePacks:disable', fileName, instancePath),
        reorder: (fileNames, instancePath) => ipc.invoke('resourcePacks:reorder', fileNames, instancePath),
        import: (filePath, instancePath) => ipc.invoke('resourcePacks:import', filePath, instancePath),
        delete: (fileName, instancePath) => ipc.invoke('resourcePacks:delete', fileName, instancePath),
        openFolder: (instancePath) => ipc.invoke('resourcePacks:openFolder', instancePath),
        add: (instancePath) => ipc.invoke('resourcePacks:add', instancePath),
    };
}

function getResourcePacksApi(): ResourcePacksAPI {
    return window.api?.resourcePacks ?? getLegacyResourcePacksApi();
}

export const resourcePacksIPC: ResourcePacksAPI = {
    list: (instancePath) => getResourcePacksApi().list(instancePath),
    enable: (fileName, instancePath) => getResourcePacksApi().enable(fileName, instancePath),
    disable: (fileName, instancePath) => getResourcePacksApi().disable(fileName, instancePath),
    reorder: (fileNames, instancePath) => getResourcePacksApi().reorder(fileNames, instancePath),
    import: (filePath, instancePath) => getResourcePacksApi().import(filePath, instancePath),
    delete: (fileName, instancePath) => getResourcePacksApi().delete(fileName, instancePath),
    openFolder: (instancePath) => getResourcePacksApi().openFolder(instancePath),
    add: (instancePath) => getResourcePacksApi().add(instancePath),
};
