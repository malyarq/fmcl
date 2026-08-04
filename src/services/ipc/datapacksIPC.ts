import type { DatapacksAPI } from '@shared/contracts';

export type { DatapackInfo, DatapackSearchResult, DatapackSearchResultItem, DatapackVersion } from '../../../shared/contracts/datapacks';

export const datapacksIPC: DatapacksAPI = {
    search: (query, mcVersion) => window.api.datapacks.search(query, mcVersion),
    getVersions: (projectId) => window.api.datapacks.getVersions(projectId),
    listByInstanceId: (instanceId, worldFolder) => window.api.datapacks.listByInstanceId(instanceId, worldFolder),
    enableByInstanceId: (instanceId, worldFolder, fileName) => window.api.datapacks.enableByInstanceId(instanceId, worldFolder, fileName),
    disableByInstanceId: (instanceId, worldFolder, fileName) => window.api.datapacks.disableByInstanceId(instanceId, worldFolder, fileName),
    deleteByInstanceId: (instanceId, worldFolder, fileName) => window.api.datapacks.deleteByInstanceId(instanceId, worldFolder, fileName),
    installByInstanceId: (instanceId, worldFolder, versionId) => window.api.datapacks.installByInstanceId(instanceId, worldFolder, versionId),
};
