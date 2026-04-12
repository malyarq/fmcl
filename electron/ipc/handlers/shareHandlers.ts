import { ipcMain } from 'electron';
import { ShareService } from '../../services/sharing/shareService';
import { validateIdentifier, validateShareCode } from '../validation/privilegedPayloads';

export function registerShareHandlers(deps: { shareService: ShareService }) {
    const { shareService } = deps;

    ipcMain.handle('share:generateCode', async (_evt, modpackId: unknown) => {
        return await shareService.generateShareCode(validateIdentifier(modpackId, 'Modpack id'));
    });

    ipcMain.handle('share:importCode', async (_evt, code: unknown) => {
        return await shareService.resolveShareCode(validateShareCode(code));
    });
}
