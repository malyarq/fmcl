import type { WorldsAPI } from '../../../shared/contracts/worlds';

export const worldsIPC: WorldsAPI = {
    listByInstanceId: (instanceId) => window.api.worlds.listByInstanceId(instanceId),
    deleteByInstanceId: (folderName, instanceId) => window.api.worlds.deleteByInstanceId(folderName, instanceId),
    backupByInstanceId: (folderName, instanceId) => window.api.worlds.backupByInstanceId(folderName, instanceId),
    duplicateByInstanceId: (folderName, instanceId) => window.api.worlds.duplicateByInstanceId(folderName, instanceId),
    openFolderByInstanceId: (folderName, instanceId) => window.api.worlds.openFolderByInstanceId(folderName, instanceId),
};
