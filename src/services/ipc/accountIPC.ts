import type { AccountAPI } from '@shared/contracts/account'
import { toIpcError } from './ipcError'

type NamespacedAccountApi = Window['api']['account']
type LegacyAccountApi = Window['account']

function getAccountApi(): NamespacedAccountApi | LegacyAccountApi | undefined {
  if (typeof window === 'undefined') return undefined
  if (window.api?.account) return window.api.account
  if (window.account) return window.account
  return undefined
}

function requireAccountApi(methodName: string): AccountAPI {
  const api = getAccountApi()
  if (!api) {
    throw new Error(`[accountIPC] account API is not available (method: ${methodName})`)
  }
  return api
}

async function call<T>(methodName: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    const error = toIpcError({ namespace: 'accountIPC', method: methodName }, err)
    console.error(error)
    throw error
  }
}

export const accountIPC = {
  isAvailable(): boolean {
    return Boolean(getAccountApi())
  },

  getAccounts(): ReturnType<AccountAPI['getAccounts']> {
    return call('getAccounts', () => requireAccountApi('getAccounts').getAccounts())
  },

  getSelectedAccount(): ReturnType<AccountAPI['getSelectedAccount']> {
    return call('getSelectedAccount', () => requireAccountApi('getSelectedAccount').getSelectedAccount())
  },

  addOfflineAccount(nickname: string): ReturnType<AccountAPI['addOfflineAccount']> {
    return call('addOfflineAccount', () => requireAccountApi('addOfflineAccount').addOfflineAccount(nickname))
  },

  addThirdPartyAccount(
    authServerUrl: string,
    username: string,
    password?: string,
  ): ReturnType<AccountAPI['addThirdPartyAccount']> {
    return call('addThirdPartyAccount', () =>
      requireAccountApi('addThirdPartyAccount').addThirdPartyAccount(authServerUrl, username, password),
    )
  },

  getSkinState(accountId: string): ReturnType<AccountAPI['getSkinState']> {
    return call('getSkinState', () => requireAccountApi('getSkinState').getSkinState(accountId))
  },

  refreshSkinState(accountId: string): ReturnType<AccountAPI['refreshSkinState']> {
    return call('refreshSkinState', () => requireAccountApi('refreshSkinState').refreshSkinState(accountId))
  },

  removeAccount(accountId: string): ReturnType<AccountAPI['removeAccount']> {
    return call('removeAccount', () => requireAccountApi('removeAccount').removeAccount(accountId))
  },

  selectAccount(accountId: string): ReturnType<AccountAPI['selectAccount']> {
    return call('selectAccount', () => requireAccountApi('selectAccount').selectAccount(accountId))
  },
}

export type AccountIPC = typeof accountIPC
