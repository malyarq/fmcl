import { ipcMain } from 'electron';
import { screenshotService } from '../../services/screenshots/screenshotService';
import { assertChildName } from '../../security/pathGuards';
import {
    getDefaultRootPath,
    getModpackDir,
    resolveApprovedInstancePath,
} from '../../services/instances/paths';
import { validateIdentifier } from '../validation/privilegedPayloads';

function resolveInstancePath(instanceId: unknown): string {
    const safeInstanceId = assertChildName(
        validateIdentifier(instanceId, 'Instance ID'),
        'Instance ID',
    );
    return resolveApprovedInstancePath(getModpackDir(getDefaultRootPath(), safeInstanceId));
}

export function registerScreenshotsHandlers() {
    ipcMain.handle('screenshots:list', async (_, instanceId: unknown) => {
        const safeInstancePath = resolveInstancePath(instanceId);
        return await screenshotService.listScreenshots(safeInstancePath);
    });

    ipcMain.handle('screenshots:delete', async (_, fileName: unknown, instanceId: unknown) => {
        const safeInstancePath = resolveInstancePath(instanceId);
        const safeFileName = assertChildName(
            validateIdentifier(fileName, 'Screenshot name'),
            'Screenshot name',
        );
        await screenshotService.deleteScreenshot(safeInstancePath, safeFileName);
        return { ok: true };
    });

    ipcMain.handle('screenshots:rename', async (_, oldName: unknown, newName: unknown, instanceId: unknown) => {
        const safeInstancePath = resolveInstancePath(instanceId);
        const safeOldName = assertChildName(
            validateIdentifier(oldName, 'Screenshot name'),
            'Screenshot name',
        );
        const safeNewName = assertChildName(
            validateIdentifier(newName, 'Screenshot name'),
            'Screenshot name',
        );
        await screenshotService.renameScreenshot(safeInstancePath, safeOldName, safeNewName);
        return { ok: true };
    });

    ipcMain.handle('screenshots:openFolder', async (_, instanceId: unknown) => {
        const safeInstancePath = resolveInstancePath(instanceId);
        await screenshotService.openScreenshotFolder(safeInstancePath);
        return { ok: true };
    });
}
