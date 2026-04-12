
import { ipcMain, shell, dialog } from 'electron';
import { resourcePacksService } from '../../services/resourcePacks/resourcePackService';
import * as path from 'path';
import * as fs from 'fs';
import { assertChildName, assertChildNameList } from '../../security/pathGuards';
import {
    resolveApprovedInstancePath,
    resolveResourcePacksDir,
} from '../../services/instances/paths';
import { resolvePathWithinRoot } from '../../security/pathGuards';

export function registerResourcePacksHandlers() {
    ipcMain.handle('resourcePacks:list', async (_, instancePath: string) => {
        const safeInstancePath = resolveApprovedInstancePath(instancePath);
        return await resourcePacksService.list(safeInstancePath);
    });

    ipcMain.handle('resourcePacks:enable', async (_, fileName: string, instancePath: string) => {
        const safeInstancePath = resolveApprovedInstancePath(instancePath);
        const safeFileName = assertChildName(fileName, 'Resource pack name');
        const ok = await resourcePacksService.enable(safeFileName, safeInstancePath);
        return { ok };
    });

    ipcMain.handle('resourcePacks:disable', async (_, fileName: string, instancePath: string) => {
        const safeInstancePath = resolveApprovedInstancePath(instancePath);
        const safeFileName = assertChildName(fileName, 'Resource pack name');
        const ok = await resourcePacksService.disable(safeFileName, safeInstancePath);
        return { ok };
    });

    ipcMain.handle('resourcePacks:reorder', async (_, fileNames: string[], instancePath: string) => {
        const safeInstancePath = resolveApprovedInstancePath(instancePath);
        const safeFileNames = assertChildNameList(fileNames, 'Resource pack name');
        const ok = await resourcePacksService.reorder(safeFileNames, safeInstancePath);
        return { ok };
    });

    ipcMain.handle('resourcePacks:import', async (_, filePath: string, instancePath: string) => {
        const safeInstancePath = resolveApprovedInstancePath(instancePath);
        assertChildName(path.basename(filePath), 'Resource pack name');
        const ok = await resourcePacksService.import(filePath, safeInstancePath);
        return { ok };
    });

    ipcMain.handle('resourcePacks:delete', async (_, fileName: string, instancePath: string) => {
        const safeInstancePath = resolveApprovedInstancePath(instancePath);
        const safeFileName = assertChildName(fileName, 'Resource pack name');
        const ok = await resourcePacksService.delete(safeFileName, safeInstancePath);
        return { ok };
    });

    ipcMain.handle('resourcePacks:openFolder', async (_, instancePath: string) => {
        const safeInstancePath = resolveApprovedInstancePath(instancePath);
        const folder = resolveResourcePacksDir(safeInstancePath);
        // Ensure folder exists? shell.openPath doesn't create it, but usually it exists if game ran.
        // We could create it if not exists using fs/promises but let's assume existence or handle error.

        if (!fs.existsSync(folder)) {
            try { fs.mkdirSync(folder, { recursive: true }); } catch (e) {
                console.error('Failed to create resourcepacks folder', e);
            }
        }
        await shell.openPath(folder);
        return { ok: true };
    });
    ipcMain.handle('resourcePacks:add', async (_, instancePath: string) => {
        const safeInstancePath = resolveApprovedInstancePath(instancePath);

        const { canceled, filePaths } = await dialog.showOpenDialog({
            properties: ['openFile', 'multiSelections'],
            filters: [{ name: 'Resource Packs', extensions: ['zip'] }]
        });

        if (canceled || filePaths.length === 0) return false;

        const folder = resolveResourcePacksDir(safeInstancePath);
        if (!fs.existsSync(folder)) {
            try { fs.mkdirSync(folder, { recursive: true }); } catch (e) {
                console.error('Failed to create resourcepacks folder', e);
                return false;
            }
        }

        let success = true;
        for (const filePath of filePaths) {
            try {
                const fileName = assertChildName(path.basename(filePath), 'Resource pack name');
                const destPath = resolvePathWithinRoot(folder, fileName, 'Resource pack path');
                fs.copyFileSync(filePath, destPath);
            } catch (err) {
                console.error('Failed to copy resource pack', err);
                success = false;
            }
        }

        return success;
    });
}
