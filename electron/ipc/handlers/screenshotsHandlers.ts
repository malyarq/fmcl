import { ipcMain } from 'electron';
import { screenshotService } from '../../services/screenshots/screenshotService';
import { assertChildName } from '../../security/pathGuards';
import { resolveApprovedInstancePath } from '../../services/instances/paths';

export function registerScreenshotsHandlers() {
    ipcMain.handle('screenshots:list', async (_, instancePath: string) => {
        const safeInstancePath = resolveApprovedInstancePath(instancePath);
        return await screenshotService.listScreenshots(safeInstancePath);
    });

    ipcMain.handle('screenshots:delete', async (_, fileName: string, instancePath: string) => {
        const safeInstancePath = resolveApprovedInstancePath(instancePath);
        const safeFileName = assertChildName(fileName, 'Screenshot name');
        await screenshotService.deleteScreenshot(safeInstancePath, safeFileName);
        return { ok: true };
    });

    ipcMain.handle('screenshots:rename', async (_, oldName: string, newName: string, instancePath: string) => {
        const safeInstancePath = resolveApprovedInstancePath(instancePath);
        const safeOldName = assertChildName(oldName, 'Screenshot name');
        const safeNewName = assertChildName(newName, 'Screenshot name');
        await screenshotService.renameScreenshot(safeInstancePath, safeOldName, safeNewName);
        return { ok: true };
    });

    ipcMain.handle('screenshots:openFolder', async (_, instancePath: string) => {
        const safeInstancePath = resolveApprovedInstancePath(instancePath);
        await screenshotService.openScreenshotFolder(safeInstancePath);
        return { ok: true };
    });
}
