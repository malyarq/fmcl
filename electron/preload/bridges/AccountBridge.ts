import { ipcRenderer } from 'electron'
import type { AccountAPI } from '@shared/contracts'

export const AccountBridge: AccountAPI = {
  getAccounts: async () => ipcRenderer.invoke('account:getAccounts'),
  getSelectedAccount: async () => ipcRenderer.invoke('account:getSelectedAccount'),
  addOfflineAccount: async (nickname) => ipcRenderer.invoke('account:addOffline', nickname),
  addThirdPartyAccount: async (url, username, password) => ipcRenderer.invoke('account:addThirdParty', url, username, password),
  getSkinState: async (accountId) => ipcRenderer.invoke('account:getSkinState', accountId),
  refreshSkinState: async (accountId) => ipcRenderer.invoke('account:refreshSkinState', accountId),
  removeAccount: async (id) => ipcRenderer.invoke('account:removeAccount', id),
  selectAccount: async (id) => ipcRenderer.invoke('account:selectAccount', id),
}
