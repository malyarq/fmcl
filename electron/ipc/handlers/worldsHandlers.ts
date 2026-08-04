import { ipcMain, shell } from 'electron';
import { worldsService } from '../../services/worlds/worldService';
import { assertChildName } from '../../security/pathGuards';
import {
    getDefaultRootPath,
    getModpackDir,
    resolveApprovedInstancePath,
    resolveWorldPath,
} from '../../services/instances/paths';
import { validateIdentifier } from '../validation/privilegedPayloads';

function resolveInstancePath(instanceId: unknown): string {
    const safeInstanceId = assertChildName(
        validateIdentifier(instanceId, 'Instance ID'),
        'Instance ID',
    );
    return resolveApprovedInstancePath(getModpackDir(getDefaultRootPath(), safeInstanceId));
}

export function registerWorldsHandlers() {
    ipcMain.removeHandler('worlds:listByInstanceId');
    ipcMain.handle('worlds:listByInstanceId', async (_evt, instanceId: unknown) => {
        return await worldsService.list(resolveInstancePath(instanceId));
    });

    ipcMain.removeHandler('worlds:deleteByInstanceId');
    ipcMain.handle('worlds:deleteByInstanceId', async (_evt, folderName: unknown, instanceId: unknown) => {
        await worldsService.delete(
            assertChildName(validateIdentifier(folderName, 'World name'), 'World name'),
            resolveInstancePath(instanceId),
        );
    });

    ipcMain.removeHandler('worlds:backupByInstanceId');
    ipcMain.handle('worlds:backupByInstanceId', async (_evt, folderName: unknown, instanceId: unknown) => {
        await worldsService.backup(
            assertChildName(validateIdentifier(folderName, 'World name'), 'World name'),
            resolveInstancePath(instanceId),
        );
    });

    ipcMain.removeHandler('worlds:duplicateByInstanceId');
    ipcMain.handle('worlds:duplicateByInstanceId', async (_evt, folderName: unknown, instanceId: unknown) => {
        return await worldsService.duplicate(
            assertChildName(validateIdentifier(folderName, 'World name'), 'World name'),
            resolveInstancePath(instanceId),
        );
    });

    ipcMain.removeHandler('worlds:openFolderByInstanceId');
    ipcMain.handle('worlds:openFolderByInstanceId', async (_evt, folderName: unknown, instanceId: unknown) => {
        const worldPath = resolveWorldPath(
            resolveInstancePath(instanceId),
            assertChildName(validateIdentifier(folderName, 'World name'), 'World name'),
        );
        await shell.openPath(worldPath);
    });
}
