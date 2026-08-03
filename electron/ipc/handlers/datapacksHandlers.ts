import { ipcMain } from 'electron';
import { datapacksService } from '../../services/instances/datapacksService';
import type { ModPlatformService } from '../../services/mods/platform/modPlatformService';
import { assertChildName } from '../../security/pathGuards';
import { resolveApprovedInstancePath } from '../../services/instances/paths';
import { validateBoundedString, validateOptionalBoundedString } from '../validation/privilegedPayloads';

export function registerDatapacksHandlers(deps: { modPlatforms: ModPlatformService }) {
    const { modPlatforms } = deps;

    ipcMain.handle('datapacks:list', async (_, instancePath: string, worldFolder: string) => {
        return await datapacksService.list(
            resolveApprovedInstancePath(instancePath),
            assertChildName(worldFolder, 'World folder'),
        );
    });

    ipcMain.handle('datapacks:enable', async (_, instancePath: string, worldFolder: string, fileName: string) => {
        await datapacksService.enable(
            resolveApprovedInstancePath(instancePath),
            assertChildName(worldFolder, 'World folder'),
            assertChildName(fileName, 'Datapack name'),
        );
        return { ok: true };
    });

    ipcMain.handle('datapacks:disable', async (_, instancePath: string, worldFolder: string, fileName: string) => {
        await datapacksService.disable(
            resolveApprovedInstancePath(instancePath),
            assertChildName(worldFolder, 'World folder'),
            assertChildName(fileName, 'Datapack name'),
        );
        return { ok: true };
    });

    ipcMain.handle('datapacks:delete', async (_, instancePath: string, worldFolder: string, fileName: string) => {
        await datapacksService.delete(
            resolveApprovedInstancePath(instancePath),
            assertChildName(worldFolder, 'World folder'),
            assertChildName(fileName, 'Datapack name'),
        );
        return { ok: true };
    });

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

    ipcMain.handle('datapacks:install', async (_, instancePath: string, worldFolder: string, versionId: string) => {
        const modrinth = modPlatforms.getModrinthClient();
        if (!modrinth) throw new Error("Modrinth client not available");

        const version = await modrinth.getProjectVersion(validateBoundedString(versionId, 'Version id', { maxLength: 128 }));
        const primaryFile = version.files.find(f => f.primary) || version.files[0];

        if (!primaryFile) throw new Error("No file found in version");

        await datapacksService.install(
            resolveApprovedInstancePath(instancePath),
            assertChildName(worldFolder, 'World folder'),
            primaryFile.url,
            assertChildName(primaryFile.filename, 'Datapack name'),
        );
        return { ok: true };
    });

    ipcMain.handle('datapacks:getVersions', async (_, projectId: string) => {
        const modrinth = modPlatforms.getModrinthClient();
        if (!modrinth) return [];
        return await modrinth.getProjectVersions(validateBoundedString(projectId, 'Project id', { maxLength: 128 }));
    });
}
