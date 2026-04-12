import { ipcMain, shell } from 'electron';
import { worldsService } from '../../services/worlds/worldService';
import { assertChildName } from '../../security/pathGuards';
import { resolveApprovedInstancePath, resolveWorldPath } from '../../services/instances/paths';

export function registerWorldsHandlers() {
    ipcMain.removeHandler('worlds:list');
    ipcMain.handle('worlds:list', async (_evt, instancePath: string) => {
        const safeInstancePath = resolveApprovedInstancePath(instancePath);
        return await worldsService.list(safeInstancePath);
    });

    ipcMain.removeHandler('worlds:delete');
    ipcMain.handle('worlds:delete', async (_evt, folderName: string, instancePath: string) => {
        const safeInstancePath = resolveApprovedInstancePath(instancePath);
        const safeFolderName = assertChildName(folderName, 'World name');
        return await worldsService.delete(safeFolderName, safeInstancePath);
    });

    ipcMain.removeHandler('worlds:backup');
    ipcMain.handle('worlds:backup', async (_evt, folderName: string, instancePath: string) => {
        const safeInstancePath = resolveApprovedInstancePath(instancePath);
        const safeFolderName = assertChildName(folderName, 'World name');
        return await worldsService.backup(safeFolderName, safeInstancePath);
    });

    ipcMain.removeHandler('worlds:duplicate');
    ipcMain.handle('worlds:duplicate', async (_evt, folderName: string, instancePath: string) => {
        const safeInstancePath = resolveApprovedInstancePath(instancePath);
        const safeFolderName = assertChildName(folderName, 'World name');
        return await worldsService.duplicate(safeFolderName, safeInstancePath);
    });

    ipcMain.removeHandler('worlds:openFolder');
    ipcMain.handle('worlds:openFolder', async (_evt, folderName: string, instancePath: string) => {
        const safeInstancePath = resolveApprovedInstancePath(instancePath);
        const worldPath = resolveWorldPath(safeInstancePath, folderName);
        await shell.openPath(worldPath);
    });
}
