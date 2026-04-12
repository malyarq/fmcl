import type { Account, AccountSkinProvider } from '../types'

export interface AccountSkinState {
  supported: boolean
  provider?: AccountSkinProvider
  providerLabel?: string
  avatarUrl?: string
  manageUrl?: string
  reason?: string
}

export interface AccountAPI {
  getAccounts(): Promise<Account[]>
  getSelectedAccount(): Promise<Account | null>
  addOfflineAccount(nickname: string): Promise<Account>
  addThirdPartyAccount(authServerUrl: string, username: string, password?: string): Promise<Account>
  getSkinState(accountId: string): Promise<AccountSkinState>
  refreshSkinState(accountId: string): Promise<AccountSkinState>
  removeAccount(accountId: string): Promise<void>
  selectAccount(accountId: string): Promise<void>
}
