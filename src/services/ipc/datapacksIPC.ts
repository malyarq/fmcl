import type { DatapacksAPI } from '@shared/contracts';

export type { Datapack, DatapackSearchResult, DatapackSearchResultItem, DatapackVersion } from '@shared/contracts';

export const datapacksIPC: DatapacksAPI = {
    list: (instancePath, worldFolder) => window.api.datapacks.list(instancePath, worldFolder),
    enable: (instancePath, worldFolder, fileName) => window.api.datapacks.enable(instancePath, worldFolder, fileName),
    disable: (instancePath, worldFolder, fileName) => window.api.datapacks.disable(instancePath, worldFolder, fileName),
    delete: (instancePath, worldFolder, fileName) => window.api.datapacks.delete(instancePath, worldFolder, fileName),
    search: (query, mcVersion) => window.api.datapacks.search(query, mcVersion),
    install: (instancePath, worldFolder, versionId) => window.api.datapacks.install(instancePath, worldFolder, versionId),
    getVersions: (projectId) => window.api.datapacks.getVersions(projectId),
};
