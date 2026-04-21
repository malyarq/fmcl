import { dialog, ipcMain, shell } from 'electron';
import * as fs from 'fs';
import type { ResourcePackAcquisitionResult } from '../../../shared/contracts/resourcePacks';
import { assertChildName, assertChildNameList } from '../../security/pathGuards';
import {
    resolveApprovedInstancePath,
    resolveResourcePacksDir,
} from '../../services/instances/paths';
import { resourcePacksService } from '../../services/resourcePacks/resourcePackService';

function summarizeResourcePackAcquisition(
    results: ResourcePackAcquisitionResult[],
): ResourcePackAcquisitionResult {
    const importedFileNames = results.flatMap((result) => result.importedFileNames);
    const issues = results.flatMap((result) => result.issues);

    if (importedFileNames.length === 0 && issues.length === 0) {
        return { status: 'cancelled', importedFileNames, issues };
    }

    if (importedFileNames.length > 0 && issues.length === 0) {
        return { status: 'success', importedFileNames, issues };
    }

    if (importedFileNames.length > 0) {
        return { status: 'partial-success', importedFileNames, issues };
    }

    if (issues.every((issue) => issue.status === 'duplicate')) {
        return { status: 'duplicate', importedFileNames, issues };
    }

    if (issues.every((issue) => issue.status === 'invalid-archive')) {
        return { status: 'invalid-archive', importedFileNames, issues };
    }

    if (issues.every((issue) => issue.status === 'runtime-blocked')) {
        return { status: 'runtime-blocked', importedFileNames, issues };
    }

    return { status: 'failure', importedFileNames, issues };
}

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
        return await resourcePacksService.import(filePath, safeInstancePath);
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

        if (!fs.existsSync(folder)) {
            try {
                fs.mkdirSync(folder, { recursive: true });
            } catch (e) {
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
            filters: [{ name: 'Resource Packs', extensions: ['zip'] }],
        });

        if (canceled || filePaths.length === 0) {
            return summarizeResourcePackAcquisition([]);
        }

        const folder = resolveResourcePacksDir(safeInstancePath);
        if (!fs.existsSync(folder)) {
            try {
                fs.mkdirSync(folder, { recursive: true });
            } catch (e) {
                console.error('Failed to create resourcepacks folder', e);
                return {
                    status: 'failure',
                    importedFileNames: [],
                    issues: [
                        {
                            fileName: 'resourcepacks',
                            status: 'failure',
                            message: 'FMCL could not prepare the resourcepacks folder for imports.',
                        },
                    ],
                };
            }
        }

        const results = await Promise.all(
            filePaths.map((filePath) => resourcePacksService.import(filePath, safeInstancePath)),
        );
        return summarizeResourcePackAcquisition(results);
    });
}
