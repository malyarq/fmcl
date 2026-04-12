import type { ResourcePacksAPI } from '../../../shared/contracts/resourcePacks';

// Use the preload bridge instead of importing ipcRenderer directly (context isolation)
const ipc = () => window.api.ipcRenderer;

export const resourcePacksIPC: ResourcePacksAPI = {
    list: (instancePath) => ipc().invoke('resourcePacks:list', instancePath),
    enable: (fileName, instancePath) => ipc().invoke('resourcePacks:enable', fileName, instancePath),
    disable: (fileName, instancePath) => ipc().invoke('resourcePacks:disable', fileName, instancePath),
    reorder: (fileNames, instancePath) => ipc().invoke('resourcePacks:reorder', fileNames, instancePath),
    import: (filePath, instancePath) => ipc().invoke('resourcePacks:import', filePath, instancePath),
    delete: (fileName, instancePath) => ipc().invoke('resourcePacks:delete', fileName, instancePath),
    openFolder: (instancePath) => ipc().invoke('resourcePacks:openFolder', instancePath),
    add: (instancePath) => ipc().invoke('resourcePacks:add', instancePath),
};
