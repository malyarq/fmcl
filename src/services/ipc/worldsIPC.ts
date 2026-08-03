import type { WorldsAPI } from '../../../shared/contracts/worlds';

export const worldsIPC: WorldsAPI = {
    list: (instancePath) => window.api.worlds.list(instancePath),
    delete: (folderName, instancePath) => window.api.worlds.delete(folderName, instancePath),
    backup: (folderName, instancePath) => window.api.worlds.backup(folderName, instancePath),
    duplicate: (folderName, instancePath) => window.api.worlds.duplicate(folderName, instancePath),
    openFolder: (folderName, instancePath) => window.api.worlds.openFolder(folderName, instancePath),
};

// Add a dedicated openFolder function
export const openWorldFolder = (folderName: string, instancePath: string) => {
    return worldsIPC.openFolder(folderName, instancePath);
};
