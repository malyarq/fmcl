import type { ResourcePacksAPI } from '../../../shared/contracts/resourcePacks';

export const resourcePacksIPC: ResourcePacksAPI = {
    list: (instancePath) => window.api.resourcePacks.list(instancePath),
    enable: (fileName, instancePath) => window.api.resourcePacks.enable(fileName, instancePath),
    disable: (fileName, instancePath) => window.api.resourcePacks.disable(fileName, instancePath),
    reorder: (fileNames, instancePath) => window.api.resourcePacks.reorder(fileNames, instancePath),
    import: (filePath, instancePath) => window.api.resourcePacks.import(filePath, instancePath),
    delete: (fileName, instancePath) => window.api.resourcePacks.delete(fileName, instancePath),
    openFolder: (instancePath) => window.api.resourcePacks.openFolder(instancePath),
    add: (instancePath) => window.api.resourcePacks.add(instancePath),
};
