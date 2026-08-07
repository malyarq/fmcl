import path from 'path';
import { randomUUID } from 'crypto';
import { safeStorage } from 'electron';
import type { Account } from '@shared/types';
import type { AccountSkinState } from '@shared/contracts/account';
import { YggdrasilClient } from './yggdrasil';
import { assertTrustedEndpointUrl } from '../../security/trustedEndpoints';
import { buildAccountSkinState, detectSkinProvider } from './skinProviders';
import { AtomicJsonStore } from '../storage/atomicJsonStore';

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

function isOptionalString(value: unknown): value is string | undefined {
    return value === undefined || typeof value === 'string';
}

function isPersistedAccount(value: unknown): value is PersistedAccount {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const account = value as Partial<PersistedAccount>;
    return typeof account.id === 'string'
        && typeof account.name === 'string'
        && (account.type === 'offline' || account.type === 'third-party')
        && isOptionalString(account.authServerUrl)
        && isOptionalString(account.accessToken)
        && isOptionalString(account.clientToken)
        && isOptionalString(account.encryptedAccessToken)
        && isOptionalString(account.encryptedClientToken);
}

function isPersistedAccountState(value: unknown): value is PersistedAccountState {
    if (!value || typeof value !== 'object') return false;
    const candidate = value as Partial<PersistedAccountState>;
    return Array.isArray(candidate.accounts)
        && candidate.accounts.every(isPersistedAccount)
        && (candidate.selectedAccountId === null || typeof candidate.selectedAccountId === 'string');
}

function hasSecureCredentialStorage(): boolean {
    if (!safeStorage.isEncryptionAvailable()) return false;

    // On Linux, Electron can fall back to the reversible `basic_text` backend
    // when no system keyring is available. Treat that fallback as unavailable
    // instead of giving users a false promise that provider tokens are secure.
    return safeStorage.getSelectedStorageBackend?.() !== 'basic_text';
}

export class AccountService {
    private accountsStore: AtomicJsonStore<PersistedAccountState>;
    private state: InternalAccountState;

    constructor(userDataPath: string) {
        this.accountsStore = new AtomicJsonStore(path.join(userDataPath, 'accounts.json'), {
            version: 1,
            mode: 0o600,
            validate: isPersistedAccountState,
        });
        const loaded = this.loadAccounts();
        this.state = loaded.state;
        if (loaded.shouldPersist) this.saveAccounts(this.state);
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
        if (!value || !hasSecureCredentialStorage()) return undefined;
        try {
            return safeStorage.decryptString(Buffer.from(value, 'base64'));
        } catch {
            return undefined;
        }
    }

    private loadAccounts(): { state: InternalAccountState; shouldPersist: boolean } {
        const loaded = this.accountsStore.read();
        if (loaded) {
            const parsed = loaded.value;
            const hasPlaintextSecrets = parsed.accounts.some(
                (account) => Boolean(account.accessToken || account.clientToken),
            );
            const hasEncryptedSecrets = parsed.accounts.some(
                (account) => Boolean(account.encryptedAccessToken || account.encryptedClientToken),
            );
            const accounts = parsed.accounts.map((account) => {
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
                if (hydratedAccount.type === 'third-party' && !hasSecureCredentialStorage()) {
                    return this.applyDerivedAccountFields({
                        ...hydratedAccount,
                        accessToken: undefined,
                        clientToken: undefined,
                        isDisabled: true,
                        disabledReason: 'secureStorageUnavailable',
                    });
                }
                return hydratedAccount;
            });
            const selectedAccountId = accounts.some(
                (account) => account.id === parsed.selectedAccountId && !account.isDisabled,
            )
                ? parsed.selectedAccountId
                : this.getFirstEnabledAccountId(accounts);
            return {
                state: { accounts, selectedAccountId },
                shouldPersist: hasPlaintextSecrets
                    || (hasEncryptedSecrets && !hasSecureCredentialStorage())
                    || ((loaded.legacy || loaded.source === 'backup') && hasSecureCredentialStorage()),
            };
        }
        return {
            state: { accounts: [], selectedAccountId: null },
            shouldPersist: true,
        };
    }

    private saveAccounts(state: InternalAccountState): void {
        const accounts = state.accounts.map((account): PersistedAccount => {
            const { accessToken, clientToken, ...publicAccount } = account;
            if (!hasSecureCredentialStorage()) return publicAccount;

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
        this.accountsStore.write({ accounts, selectedAccountId: state.selectedAccountId });
    }

    private commitState(state: InternalAccountState): void {
        this.saveAccounts(state);
        this.state = state;
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
        this.commitState({
            accounts: [...this.state.accounts, nextAccount],
            selectedAccountId: this.state.selectedAccountId ?? nextAccount.id,
        });
        return this.toPublicAccount(nextAccount);
    }

    public async addThirdPartyAccount(authServerUrl: string, username: string, password?: string): Promise<Account> {
        if (!hasSecureCredentialStorage()) {
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

        const accounts = [...this.state.accounts];
        if (existingIndex !== -1) accounts[existingIndex] = hydratedAccount;
        else accounts.push(hydratedAccount);
        this.commitState({ accounts, selectedAccountId: hydratedAccount.id });
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
        const accounts = [...this.state.accounts];
        accounts[index] = refreshedAccount;
        this.commitState({ ...this.state, accounts });

        return buildAccountSkinState(refreshedAccount);
    }

    public selectAccount(accountId: string): void {
        if (this.state.accounts.some((account) => account.id === accountId && !account.isDisabled)) {
            this.commitState({ ...this.state, selectedAccountId: accountId });
        }
    }

    public removeAccount(accountId: string): void {
        const accounts = this.state.accounts.filter(a => a.id !== accountId);
        const selectedAccountId = this.state.selectedAccountId === accountId
            ? this.getFirstEnabledAccountId(accounts)
            : this.state.selectedAccountId;
        this.commitState({ accounts, selectedAccountId });
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
                        const accounts = [...this.state.accounts];
                        accounts[index] = updatedAccount;
                        this.commitState({ ...this.state, accounts });
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
