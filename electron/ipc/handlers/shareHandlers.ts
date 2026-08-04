import { ipcMain } from 'electron';
import { ShareService } from '../../services/sharing/shareService';
import { validateIdentifier } from '../validation/privilegedPayloads';

export function registerShareHandlers(deps: { shareService: ShareService }) {
    const { shareService } = deps;

    ipcMain.handle('share:generateCode', async (_evt, modpackId: unknown) => {
        return await shareService.generateShareCode(validateIdentifier(modpackId, 'Modpack id'));
    });

    ipcMain.removeHandler('share:importCode');
}
