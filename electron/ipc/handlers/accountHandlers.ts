import { ipcMain } from 'electron';
import { AccountService } from '../../services/account/accountService';
import {
    validateEndpointUrl,
    validateIdentifier,
    validateOfflineNickname,
    validateOptionalSecret,
    validateThirdPartyUsername,
} from '../validation/privilegedPayloads';

export function registerAccountHandlers(deps: { accountService: AccountService }) {
    const { accountService } = deps;

    ipcMain.handle('account:getAccounts', () => {
        return accountService.getAccounts();
    });

    ipcMain.handle('account:getSelectedAccount', () => {
        return accountService.getSelectedAccount();
    });

    ipcMain.handle('account:selectAccount', (_event, accountId: unknown) => {
        accountService.selectAccount(validateIdentifier(accountId, 'Account id'));
    });

    ipcMain.handle('account:addOffline', async (_event, nickname: unknown) => {
        return await accountService.addOfflineAccount(validateOfflineNickname(nickname));
    });

    ipcMain.handle('account:addThirdParty', async (_event, authServerUrl: unknown, username: unknown, password?: unknown) => {
        return await accountService.addThirdPartyAccount(
            validateEndpointUrl(authServerUrl, 'Third-party auth server URL'),
            validateThirdPartyUsername(username),
            validateOptionalSecret(password, 'Third-party account password'),
        );
    });

    ipcMain.handle('account:getSkinState', (_event, accountId: unknown) => {
        return accountService.getSkinState(validateIdentifier(accountId, 'Account id'));
    });

    ipcMain.handle('account:refreshSkinState', (_event, accountId: unknown) => {
        return accountService.refreshSkinState(validateIdentifier(accountId, 'Account id'));
    });

    ipcMain.handle('account:removeAccount', (_event, accountId: unknown) => {
        accountService.removeAccount(validateIdentifier(accountId, 'Account id'));
    });
}
