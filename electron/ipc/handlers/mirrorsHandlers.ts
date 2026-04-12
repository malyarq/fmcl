import { ipcMain } from 'electron';
import { MirrorsService } from '../../services/mirrors/mirrorsService';
import {
    validateBoolean,
    validateBoundedString,
    validateEndpointUrl,
    validateEnum,
    validateIdentifier,
} from '../validation/privilegedPayloads';

export function registerMirrorsHandlers({ mirrorsService }: { mirrorsService: MirrorsService }) {
    ipcMain.handle('mirrors:getMirrors', async () => {
        return mirrorsService.getMirrors();
    });

    ipcMain.handle('mirrors:getSelectedMirror', async () => {
        return mirrorsService.getSelectedMirror();
    });

    ipcMain.handle('mirrors:addCustomMirror', async (_, name: unknown, rootUrl: unknown) => {
        return await mirrorsService.addCustomMirror(
            validateBoundedString(name, 'Custom mirror name', { minLength: 2, maxLength: 80 }),
            validateEndpointUrl(rootUrl, 'Custom mirror URL'),
        );
    });

    ipcMain.handle('mirrors:removeMirror', async (_, id: unknown) => {
        await mirrorsService.removeMirror(validateIdentifier(id, 'Mirror id'));
    });

    ipcMain.handle('mirrors:selectMirror', async (_, id: unknown) => {
        await mirrorsService.selectMirror(validateIdentifier(id, 'Mirror id'));
    });

    ipcMain.handle('mirrors:moveMirror', async (_, id: unknown, direction: unknown) => {
        await mirrorsService.moveMirror(
            validateIdentifier(id, 'Mirror id'),
            validateEnum(direction, 'Mirror move direction', ['up', 'down'] as const),
        );
    });

    ipcMain.handle('mirrors:testSpeed', async (_, url: unknown) => {
        return await mirrorsService.testSpeed(validateEndpointUrl(url, 'Mirror speed test URL'));
    });

    ipcMain.handle('mirrors:setAutoSelect', async (_, enabled: unknown) => {
        return await mirrorsService.setAutoSelect(validateBoolean(enabled, 'Mirror auto-select flag'));
    });

    ipcMain.handle('mirrors:isAutoSelectEnabled', async () => {
        return await mirrorsService.isAutoSelectEnabled();
    });
}
