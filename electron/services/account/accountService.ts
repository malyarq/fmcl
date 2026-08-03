import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import { safeStorage } from 'electron';
import type { Account } from '@shared/types';
import type { AccountSkinState } from '@shared/contracts/account';
import { YggdrasilClient } from './yggdrasil';
import { assertTrustedEndpointUrl } from '../../security/trustedEndpoints';
import { buildAccountSkinState, detectSkinProvider } from './skinProviders';

type InternalAccount = Account & {
    accessToken?: string;
    clientToken?: string;
};

type InternalAccountState = {
    accounts: InternalAccount[];
    selectedAccountId: string | null;
};

type PersistedAccount = Account & {
    accessToken?: string;
    clientToken?: string;
    encryptedAccessToken?: string;
    encryptedClientToken?: string;
};

type PersistedAccountState = {
    accounts: PersistedAccount[];
    selectedAccountId: string | null;
};

export class AccountService {
    private accountsFile: string;
    private state: InternalAccountState;

    constructor(userDataPath: string) {
        this.accountsFile = path.join(userDataPath, 'accounts.json');
        this.state = this.loadAccounts();
        this.saveAccounts();
    }

    private applyDerivedAccountFields(account: InternalAccount): InternalAccount {
        const skinState = buildAccountSkinState(account);
        return {
            ...account,
            avatar: skinState.avatarUrl,
            skinProvider: skinState.provider,
        };
    }

    private revalidateAccount(account: InternalAccount): InternalAccount {
        if (account.type !== 'third-party' || !account.authServerUrl) {
            return this.applyDerivedAccountFields({
                ...account,
                isDisabled: false,
                disabledReason: undefined,
            });
        }

        if (!account.accessToken || !account.clientToken) {
            return this.applyDerivedAccountFields({
                ...account,
                isDisabled: true,
                disabledReason: 'reauthenticationRequired',
            });
        }

        try {
            assertTrustedEndpointUrl(account.authServerUrl, 'Third-party auth server URL');
            return this.applyDerivedAccountFields({
                ...account,
                isDisabled: false,
                disabledReason: undefined,
                skinProvider: detectSkinProvider(account.authServerUrl),
            });
        } catch {
            return this.applyDerivedAccountFields({
                ...account,
                isDisabled: true,
                disabledReason: 'insecureRemoteHttp',
            });
        }
    }

    private getFirstEnabledAccountId(accounts: InternalAccount[]): string | null {
        return accounts.find((account) => !account.isDisabled)?.id ?? null;
    }

    private decryptSecret(value: string | undefined): string | undefined {
        if (!value || !safeStorage.isEncryptionAvailable()) return undefined;
        try {
            return safeStorage.decryptString(Buffer.from(value, 'base64'));
        } catch {
            return undefined;
        }
    }

    private loadAccounts(): InternalAccountState {
        try {
            if (fs.existsSync(this.accountsFile)) {
                const data = fs.readFileSync(this.accountsFile, 'utf-8');
                const parsed = JSON.parse(data) as Partial<PersistedAccountState>;
                const accounts = Array.isArray(parsed.accounts)
                    ? parsed.accounts.map((account) => {
                        const {
                            encryptedAccessToken,
                            encryptedClientToken,
                            accessToken,
                            clientToken,
                            ...publicAccount
                        } = account;
                        const hydratedAccount = this.revalidateAccount({
                            ...publicAccount,
                            accessToken: this.decryptSecret(encryptedAccessToken) ?? accessToken,
                            clientToken: this.decryptSecret(encryptedClientToken) ?? clientToken,
                        });
                        if (hydratedAccount.type === 'third-party' && !safeStorage.isEncryptionAvailable()) {
                            return this.applyDerivedAccountFields({
                                ...hydratedAccount,
                                accessToken: undefined,
                                clientToken: undefined,
                                isDisabled: true,
                                disabledReason: 'secureStorageUnavailable',
                            });
                        }
                        return hydratedAccount;
                    })
                    : [];
                const selectedAccountId = accounts.some(
                    (account) => account.id === parsed.selectedAccountId && !account.isDisabled,
                )
                    ? parsed.selectedAccountId ?? null
                    : this.getFirstEnabledAccountId(accounts);
                return { accounts, selectedAccountId };
            }
        } catch (error) {
            console.error('Failed to load accounts:', error);
        }
        return { accounts: [], selectedAccountId: null };
    }

    private saveAccounts() {
        try {
            fs.mkdirSync(path.dirname(this.accountsFile), { recursive: true });
            const accounts = this.state.accounts.map((account): PersistedAccount => {
                const { accessToken, clientToken, ...publicAccount } = account;
                if (!safeStorage.isEncryptionAvailable()) return publicAccount;

                return {
                    ...publicAccount,
                    encryptedAccessToken: accessToken
                        ? safeStorage.encryptString(accessToken).toString('base64')
                        : undefined,
                    encryptedClientToken: clientToken
                        ? safeStorage.encryptString(clientToken).toString('base64')
                        : undefined,
                };
            });
            const persistedState: PersistedAccountState = {
                accounts,
                selectedAccountId: this.state.selectedAccountId,
            };
            const tempPath = `${this.accountsFile}.tmp`;
            fs.writeFileSync(tempPath, JSON.stringify(persistedState, null, 2), { mode: 0o600 });
            fs.renameSync(tempPath, this.accountsFile);
            fs.chmodSync(this.accountsFile, 0o600);
        } catch (error) {
            console.error('Failed to save accounts:', error);
        }
    }

    private toPublicAccount(account: InternalAccount): Account {
        const publicAccount: InternalAccount = { ...account };
        delete publicAccount.accessToken;
        delete publicAccount.clientToken;
        return publicAccount;
    }

    private getSelectedInternalAccount(): InternalAccount | null {
        if (!this.state.selectedAccountId) return null;
        return this.state.accounts.find(
            (account) => account.id === this.state.selectedAccountId && !account.isDisabled,
        ) || null;
    }

    public getAccounts(): Account[] {
        return this.state.accounts.map((account) => this.toPublicAccount(account));
    }

    public getSelectedAccount(): Account | null {
        const account = this.getSelectedInternalAccount();
        return account ? this.toPublicAccount(account) : null;
    }

    public getSelectedAccountId(): string | null {
        return this.state.selectedAccountId;
    }

    public async addOfflineAccount(nickname: string): Promise<Account> {
        const account: Account = {
            id: randomUUID(),
            type: 'offline',
            name: nickname,
            isDisabled: false,
        };
        const nextAccount = this.applyDerivedAccountFields(account);
        this.state.accounts.push(nextAccount);
        if (!this.state.selectedAccountId) {
            this.state.selectedAccountId = nextAccount.id;
        }
        this.saveAccounts();
        return this.toPublicAccount(nextAccount);
    }

    public async addThirdPartyAccount(authServerUrl: string, username: string, password?: string): Promise<Account> {
        if (!safeStorage.isEncryptionAvailable()) {
            throw new Error('Secure credential storage is unavailable on this system');
        }

        const safeAuthServerUrl = assertTrustedEndpointUrl(authServerUrl, 'Third-party auth server URL');
        const client = new YggdrasilClient(safeAuthServerUrl);
        const result = await client.authenticate(username, password);

        // Check if account already exists (by UUID or name+authServer)
        const existingIndex = this.state.accounts.findIndex(
            (a) => a.type === 'third-party' &&
                a.authServerUrl === safeAuthServerUrl &&
                (a.id === result.selectedProfile.id || a.name === result.selectedProfile.name)
        );

        const account: InternalAccount = {
            id: result.selectedProfile.id, // Use UUID from server
            type: 'third-party',
            name: result.selectedProfile.name,
            authServerUrl: safeAuthServerUrl,
            loginIdentity: username,
            accessToken: result.accessToken,
            clientToken: result.clientToken,
            user: result.user,
            skinProvider: detectSkinProvider(safeAuthServerUrl),
            isDisabled: false,
        };
        const hydratedAccount = this.applyDerivedAccountFields(account);

        if (existingIndex !== -1) {
            this.state.accounts[existingIndex] = hydratedAccount;
        } else {
            this.state.accounts.push(hydratedAccount);
        }

        this.state.selectedAccountId = hydratedAccount.id;
        this.saveAccounts();
        return this.toPublicAccount(hydratedAccount);
    }

    public getSkinState(accountId: string): AccountSkinState {
        const account = this.state.accounts.find((entry) => entry.id === accountId);
        if (!account) {
            throw new Error('Account not found');
        }

        return buildAccountSkinState(account);
    }

    public refreshSkinState(accountId: string): AccountSkinState {
        const index = this.state.accounts.findIndex((entry) => entry.id === accountId);
        if (index === -1) {
            throw new Error('Account not found');
        }

        const refreshedAccount = this.revalidateAccount(this.state.accounts[index]);
        this.state.accounts[index] = refreshedAccount;
        this.saveAccounts();

        return buildAccountSkinState(refreshedAccount);
    }

    public selectAccount(accountId: string): void {
        if (this.state.accounts.some((account) => account.id === accountId && !account.isDisabled)) {
            this.state.selectedAccountId = accountId;
            this.saveAccounts();
        }
    }

    public removeAccount(accountId: string): void {
        this.state.accounts = this.state.accounts.filter(a => a.id !== accountId);
        if (this.state.selectedAccountId === accountId) {
            this.state.selectedAccountId = this.state.accounts.length > 0 ? this.state.accounts[0].id : null;
        }
        this.saveAccounts();
    }

    // Refresh token for selected account if needed
    public async ensureActiveAccountValid(): Promise<InternalAccount | null> {
        const account = this.getSelectedInternalAccount();
        if (!account) return null;

        if (account.type === 'offline') return account;
        if (account.isDisabled) return null;

        if (account.type === 'third-party' && account.authServerUrl && account.accessToken && account.clientToken) {
            const client = new YggdrasilClient(account.authServerUrl);
            try {
                const isValid = await client.validate(account.accessToken, account.clientToken);
                if (!isValid) {
                    console.log('[AccountService] Token invalid, refreshing...');
                    const result = await client.refresh(account.accessToken, account.clientToken);
                    // Update account with new token
                    const updatedAccount: InternalAccount = this.applyDerivedAccountFields({
                        ...account,
                        accessToken: result.accessToken,
                        clientToken: result.clientToken,
                        user: result.user || account.user,
                        isDisabled: false,
                        disabledReason: undefined,
                    });

                    // Update in state
                    const index = this.state.accounts.findIndex(a => a.id === account.id);
                    if (index !== -1) {
                        this.state.accounts[index] = updatedAccount;
                        this.saveAccounts();
                    }
                    return updatedAccount;
                }
            } catch (e) {
                console.error('[AccountService] Failed to refresh token:', e);
                // Could throw error or return null to indicate login required
                // For now, return account but it might fail later in launcher
            }
        }
        return account;
    }
}
