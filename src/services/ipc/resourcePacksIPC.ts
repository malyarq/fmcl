import type { ResourcePacksAPI } from '../../../shared/contracts/resourcePacks';

export const resourcePacksIPC: ResourcePacksAPI = {
    list: (instanceId) => window.api.resourcePacks.list(instanceId),
    enable: (instanceId, fileName) => window.api.resourcePacks.enable(instanceId, fileName),
    disable: (instanceId, fileName) => window.api.resourcePacks.disable(instanceId, fileName),
    reorder: (instanceId, fileNames) => window.api.resourcePacks.reorder(instanceId, fileNames),
    delete: (instanceId, fileName) => window.api.resourcePacks.delete(instanceId, fileName),
    openFolder: (instanceId) => window.api.resourcePacks.openFolder(instanceId),
    add: (instanceId) => window.api.resourcePacks.add(instanceId),
};
