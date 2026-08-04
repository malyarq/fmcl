import { ipcMain } from 'electron';
import { datapacksService } from '../../services/instances/datapacksService';
import type { ModPlatformService } from '../../services/mods/platform/modPlatformService';
import { assertChildName } from '../../security/pathGuards';
import {
    getDefaultRootPath,
    getModpackDir,
    resolveApprovedInstancePath,
} from '../../services/instances/paths';
import {
    validateBoundedString,
    validateIdentifier,
    validateOptionalBoundedString,
} from '../validation/privilegedPayloads';

function resolveInstancePath(instanceId: unknown): string {
    const safeInstanceId = assertChildName(
        validateIdentifier(instanceId, 'Instance ID'),
        'Instance ID',
    );
    return resolveApprovedInstancePath(getModpackDir(getDefaultRootPath(), safeInstanceId));
}

function validateWorldFolder(value: unknown): string {
    return assertChildName(validateIdentifier(value, 'World folder'), 'World folder');
}

function validateDatapackName(value: unknown): string {
    return assertChildName(validateIdentifier(value, 'Datapack name'), 'Datapack name');
}

export function registerDatapacksHandlers(deps: { modPlatforms: ModPlatformService }) {
    const { modPlatforms } = deps;

    ipcMain.handle('datapacks:search', async (_, query: string, mcVersion?: string) => {
        const modrinth = modPlatforms.getModrinthClient();
        if (!modrinth) return { hits: [], total_hits: 0 };

        // Build facets array
        const facetGroups: string[][] = [["project_type:datapack"]];
        if (mcVersion) {
            facetGroups.push([`versions:${mcVersion}`]);
        }
        const facets = JSON.stringify(facetGroups);

        const results = await modrinth.searchProjects({
            query: validateOptionalBoundedString(query, 'Datapack search query', { maxLength: 256 }) || '',
            facets,
            limit: 20
        });

        return results;
    });

    ipcMain.handle('datapacks:getVersions', async (_, projectId: string) => {
        const modrinth = modPlatforms.getModrinthClient();
        if (!modrinth) return [];
        return await modrinth.getProjectVersions(validateBoundedString(projectId, 'Project id', { maxLength: 128 }));
    });

    ipcMain.handle('datapacks:listByInstanceId', async (_, instanceId: unknown, worldFolder: unknown) => {
        const safeWorldFolder = validateWorldFolder(worldFolder);
        const datapacks = await datapacksService.list(
            resolveInstancePath(instanceId),
            safeWorldFolder,
        );
        return datapacks.map(({ path: _path, ...datapack }) => datapack);
    });

    ipcMain.handle('datapacks:enableByInstanceId', async (_, instanceId: unknown, worldFolder: unknown, fileName: unknown) => {
        const safeWorldFolder = validateWorldFolder(worldFolder);
        const safeFileName = validateDatapackName(fileName);
        await datapacksService.enable(
            resolveInstancePath(instanceId),
            safeWorldFolder,
            safeFileName,
        );
        return { ok: true };
    });

    ipcMain.handle('datapacks:disableByInstanceId', async (_, instanceId: unknown, worldFolder: unknown, fileName: unknown) => {
        const safeWorldFolder = validateWorldFolder(worldFolder);
        const safeFileName = validateDatapackName(fileName);
        await datapacksService.disable(
            resolveInstancePath(instanceId),
            safeWorldFolder,
            safeFileName,
        );
        return { ok: true };
    });

    ipcMain.handle('datapacks:deleteByInstanceId', async (_, instanceId: unknown, worldFolder: unknown, fileName: unknown) => {
        const safeWorldFolder = validateWorldFolder(worldFolder);
        const safeFileName = validateDatapackName(fileName);
        await datapacksService.delete(
            resolveInstancePath(instanceId),
            safeWorldFolder,
            safeFileName,
        );
        return { ok: true };
    });

    ipcMain.handle('datapacks:installByInstanceId', async (_, instanceId: unknown, worldFolder: unknown, versionId: unknown) => {
        const safeWorldFolder = validateWorldFolder(worldFolder);
        const modrinth = modPlatforms.getModrinthClient();
        if (!modrinth) throw new Error('Modrinth client not available');

        const version = await modrinth.getProjectVersion(validateBoundedString(versionId, 'Version id', { maxLength: 128 }));
        const primaryFile = version.files.find(f => f.primary) || version.files[0];

        if (!primaryFile) throw new Error('No file found in version');

        await datapacksService.install(
            resolveInstancePath(instanceId),
            safeWorldFolder,
            primaryFile.url,
            validateDatapackName(primaryFile.filename),
        );
        return { ok: true };
    });
}
