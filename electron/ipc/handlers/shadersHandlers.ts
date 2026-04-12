import { ipcMain, shell, dialog } from 'electron';
import { shadersService } from '../../services/shaders/shaderService';
import * as path from 'path';
import * as fs from 'fs';
import { assertChildName } from '../../security/pathGuards';
import {
    resolveApprovedInstancePath,
    resolveShaderPacksDir,
} from '../../services/instances/paths';
import { resolvePathWithinRoot } from '../../security/pathGuards';

export function registerShadersHandlers() {
    ipcMain.removeHandler('shaders:list');
    ipcMain.handle('shaders:list', async (_evt, instancePath: string) => {
        const safeInstancePath = resolveApprovedInstancePath(instancePath);
        return await shadersService.list(safeInstancePath);
    });

    ipcMain.removeHandler('shaders:setActive');
    ipcMain.handle('shaders:setActive', async (_evt, shaderName: string, instancePath: string) => {
        const safeInstancePath = resolveApprovedInstancePath(instancePath);
        const safeShaderName = assertChildName(shaderName, 'Shader pack name');
        return await shadersService.setActiveShader(safeShaderName, safeInstancePath);
    });

    ipcMain.removeHandler('shaders:disable');
    ipcMain.handle('shaders:disable', async (_evt, instancePath: string) => {
        const safeInstancePath = resolveApprovedInstancePath(instancePath);
        return await shadersService.disable(safeInstancePath);
    });

    ipcMain.removeHandler('shaders:delete');
    ipcMain.handle('shaders:delete', async (_evt, fileName: string, instancePath: string) => {
        const safeInstancePath = resolveApprovedInstancePath(instancePath);
        const safeFileName = assertChildName(fileName, 'Shader pack name');
        return await shadersService.delete(safeFileName, safeInstancePath);
    });

    ipcMain.removeHandler('shaders:openFolder');
    ipcMain.handle('shaders:openFolder', async (_evt, instancePath: string) => {
        const safeInstancePath = resolveApprovedInstancePath(instancePath);

        const folder = resolveShaderPacksDir(safeInstancePath);


        if (!fs.existsSync(folder)) {
            try { fs.mkdirSync(folder, { recursive: true }); } catch (e) {
                console.error('Failed to create shaderpacks folder', e);
            }
        }

        await shell.openPath(folder);
    });

    ipcMain.removeHandler('shaders:add');
    ipcMain.handle('shaders:add', async (_evt, instancePath: string) => {
        const safeInstancePath = resolveApprovedInstancePath(instancePath);

        const { canceled, filePaths } = await dialog.showOpenDialog({
            properties: ['openFile', 'multiSelections'],
            filters: [{ name: 'Shader Packs', extensions: ['zip'] }]
        });

        if (canceled || filePaths.length === 0) return false;

        const folder = resolveShaderPacksDir(safeInstancePath);
        if (!fs.existsSync(folder)) {
            try { fs.mkdirSync(folder, { recursive: true }); } catch (e) {
                console.error('Failed to create shaderpacks folder', e);
                return false;
            }
        }

        let success = true;
        for (const filePath of filePaths) {
            try {
                const fileName = assertChildName(path.basename(filePath), 'Shader pack name');
                const destPath = resolvePathWithinRoot(folder, fileName, 'Shader pack path');
                fs.copyFileSync(filePath, destPath);
            } catch (err) {
                console.error('Failed to copy shader pack', err);
                success = false;
            }
        }

        return success;
    });
}
