import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import type { Account, AccountState } from '@shared/types';
import type { AccountSkinState } from '@shared/contracts/account';
import { YggdrasilClient } from './yggdrasil';
import { assertTrustedEndpointUrl } from '../../security/trustedEndpoints';
import { buildAccountSkinState, detectSkinProvider } from './skinProviders';

export class AccountService {
    private accountsFile: string;
    private state: AccountState;

    constructor(userDataPath: string) {
        this.accountsFile = path.join(userDataPath, 'accounts.json');
        this.state = this.loadAccounts();
    }

    private applyDerivedAccountFields(account: Account): Account {
        const skinState = buildAccountSkinState(account);
        return {
            ...account,
            avatar: skinState.avatarUrl,
            skinProvider: skinState.provider,
        };
    }

    private revalidateAccount(account: Account): Account {
        if (account.type !== 'third-party' || !account.authServerUrl) {
            return this.applyDerivedAccountFields({
                ...account,
                isDisabled: false,
                disabledReason: undefined,
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

    private getFirstEnabledAccountId(accounts: Account[]): string | null {
        return accounts.find((account) => !account.isDisabled)?.id ?? null;
    }

    private loadAccounts(): AccountState {
        try {
            if (fs.existsSync(this.accountsFile)) {
                const data = fs.readFileSync(this.accountsFile, 'utf-8');
                const parsed = JSON.parse(data) as Partial<AccountState>;
                const accounts = Array.isArray(parsed.accounts)
                    ? parsed.accounts.map((account) => this.revalidateAccount(account))
                    : [];
                const selectedAccountId = accounts.some(
                    (account) => account.id === parsed.selectedAccountId && !account.isDisabled,
                )
                    ? parsed.selectedAccountId ?? null
                    : this.getFirstEnabledAccountId(accounts);
                const nextState = { accounts, selectedAccountId };

                if (JSON.stringify(nextState) !== JSON.stringify({
                    accounts: parsed.accounts ?? [],
                    selectedAccountId: parsed.selectedAccountId ?? null,
                })) {
                    fs.writeFileSync(this.accountsFile, JSON.stringify(nextState, null, 2));
                }

                return nextState;
            }
        } catch (error) {
            console.error('Failed to load accounts:', error);
        }
        return { accounts: [], selectedAccountId: null };
    }

    private saveAccounts() {
        try {
            fs.writeFileSync(this.accountsFile, JSON.stringify(this.state, null, 2));
        } catch (error) {
            console.error('Failed to save accounts:', error);
        }
    }

    public getAccounts(): Account[] {
        return this.state.accounts;
    }

    public getSelectedAccount(): Account | null {
        if (!this.state.selectedAccountId) return null;
        return this.state.accounts.find(
            (account) => account.id === this.state.selectedAccountId && !account.isDisabled,
        ) || null;
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
        return nextAccount;
    }

    public async addThirdPartyAccount(authServerUrl: string, username: string, password?: string): Promise<Account> {
        const safeAuthServerUrl = assertTrustedEndpointUrl(authServerUrl, 'Third-party auth server URL');
        const client = new YggdrasilClient(safeAuthServerUrl);
        const result = await client.authenticate(username, password);

        // Check if account already exists (by UUID or name+authServer)
        const existingIndex = this.state.accounts.findIndex(
            (a) => a.type === 'third-party' &&
                a.authServerUrl === safeAuthServerUrl &&
                (a.id === result.selectedProfile.id || a.name === result.selectedProfile.name)
        );

        const account: Account = {
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
        return hydratedAccount;
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
    public async ensureActiveAccountValid(): Promise<Account | null> {
        const account = this.getSelectedAccount();
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
                    const updatedAccount: Account = this.applyDerivedAccountFields({
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
