export type AccountType = 'offline' | 'third-party';
export type AccountDisabledReason =
    | 'insecureRemoteHttp'
    | 'secureStorageUnavailable'
    | 'reauthenticationRequired';
export type AccountSkinProvider = 'blessing-skin' | 'littleskin';

export interface AuthProfile {
    id: string;
    name: string;
}

export interface Account {
    id: string; // UUID or unique identifier
    type: AccountType;
    name: string;
    avatar?: string; // URL to skin avatar

    // For Third-Party (Authlib Injector)
    authServerUrl?: string; // The API root URL
    loginIdentity?: string;
    user?: {
        id: string;
        properties?: Array<{ name: string; value: string }>;
    };
    skinProvider?: AccountSkinProvider;
    isDisabled?: boolean;
    disabledReason?: AccountDisabledReason;
}

export interface AccountState {
    accounts: Account[];
    selectedAccountId: string | null;
}
