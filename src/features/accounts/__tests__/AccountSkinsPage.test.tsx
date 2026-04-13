// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AccountsPage } from '../AccountsPage'

const confirmMock = vi.fn()
const getAccountsMock = vi.fn()
const getSelectedAccountMock = vi.fn()
const getSkinStateMock = vi.fn()
const refreshSkinStateMock = vi.fn()
const openExternalMock = vi.fn()

vi.mock('../../../contexts/SettingsContext', () => ({
  useSettings: () => ({
    t: (key: string) =>
      ({
        'accounts.title': 'Accounts',
        'accounts.description': 'Manage your Minecraft accounts and switch between them.',
        'accounts.skinTitle': 'Skin Management',
        'accounts.skinRefresh': 'Refresh Preview',
        'accounts.skinOpenProvider': 'Open Skin Site',
        'accounts.skinUnsupportedOffline': 'Offline accounts do not have a provider skin page.',
        'accounts.skinUnsupportedHint': 'Supported providers in this release: Blessing Skin and LittleSkin.',
        'accounts.skinManageHint': 'Refresh the preview or open the provider site to change skins.',
        'accounts.skinLoading': 'Loading skin information...',
        'accounts.typeOffline': 'Offline',
        'accounts.typeThirdParty': 'Third Party',
        'accounts.addAccount': 'Add Account',
        'accounts.providerSupportHint': 'Blessing Skin and LittleSkin are supported for provider-aware skin management.',
      }[key] ?? key),
  }),
}))

vi.mock('../../../contexts/ConfirmContext', () => ({
  useConfirm: () => ({
    confirm: (...args: unknown[]) => confirmMock(...args),
  }),
}))

vi.mock('../../../contexts/ToastContext', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
  }),
}))

vi.mock('../../../services/ipc/accountIPC', () => ({
  accountIPC: {
    getAccounts: (...args: unknown[]) => getAccountsMock(...args),
    getSelectedAccount: (...args: unknown[]) => getSelectedAccountMock(...args),
    getSkinState: (...args: unknown[]) => getSkinStateMock(...args),
    refreshSkinState: (...args: unknown[]) => refreshSkinStateMock(...args),
    removeAccount: vi.fn(),
    selectAccount: vi.fn(),
  },
}))

vi.mock('../../../services/ipc/externalLinksIPC', () => ({
  externalLinksIPC: {
    open: (...args: unknown[]) => openExternalMock(...args),
  },
}))

vi.mock('../AddAccountDialog', () => ({
  AddAccountDialog: () => null,
}))

describe('AccountsPage skin panel', () => {
  beforeEach(() => {
    cleanup()
    confirmMock.mockReset()
    getAccountsMock.mockReset()
    getSelectedAccountMock.mockReset()
    getSkinStateMock.mockReset()
    refreshSkinStateMock.mockReset()
    openExternalMock.mockReset()

    const selectedAccount = {
      id: 'account-1',
      type: 'third-party',
      name: 'PlayerOne',
      authServerUrl: 'https://littleskin.cn/api/yggdrasil',
      avatar: 'https://littleskin.cn/avatar/player/64/PlayerOne.png',
      skinProvider: 'littleskin',
    }

    getAccountsMock.mockResolvedValue([selectedAccount])
    getSelectedAccountMock.mockResolvedValue(selectedAccount)
    getSkinStateMock.mockResolvedValue({
      supported: true,
      provider: 'littleskin',
      providerLabel: 'LittleSkin',
      avatarUrl: 'https://littleskin.cn/avatar/player/64/PlayerOne.png',
      manageUrl: 'https://littleskin.cn/user',
    })
    refreshSkinStateMock.mockResolvedValue({
      supported: true,
      provider: 'littleskin',
      providerLabel: 'LittleSkin',
      avatarUrl: 'https://littleskin.cn/avatar/player/64/PlayerOne.png',
      manageUrl: 'https://littleskin.cn/user',
    })
    openExternalMock.mockResolvedValue({
      status: 'opened',
      url: 'https://littleskin.cn/user',
    })
  })

  it('shows a provider-aware skin panel for the selected account', async () => {
    render(<AccountsPage />)

    await screen.findByText('Skin Management')
    expect((await screen.findAllByText('LittleSkin')).length).toBeGreaterThan(0)

    await waitFor(() => {
      expect(getSkinStateMock).toHaveBeenCalledWith('account-1')
    })
  })

  it('refreshes the provider preview and opens the provider page', async () => {
    render(<AccountsPage />)

    expect((await screen.findAllByText('LittleSkin')).length).toBeGreaterThan(0)
    const refreshButton = await screen.findByRole('button', { name: 'Refresh Preview' }) as HTMLButtonElement
    await waitFor(() => {
      expect(refreshButton.disabled).toBe(false)
    })
    fireEvent.click(refreshButton)

    await waitFor(() => {
      expect(refreshSkinStateMock).toHaveBeenCalledWith('account-1')
    })

    fireEvent.click(screen.getByRole('button', { name: 'Open Skin Site' }))

    await waitFor(() => {
      expect(openExternalMock).toHaveBeenCalledWith({
        url: 'https://littleskin.cn/user',
        context: 'account-skin:account-1',
      })
    })
  })

  it('keeps skin actions disabled for offline accounts without a provider page', async () => {
    const offlineAccount = {
      id: 'offline-account',
      type: 'offline',
      name: 'OfflineOnly',
    }

    getAccountsMock.mockResolvedValue([offlineAccount])
    getSelectedAccountMock.mockResolvedValue(offlineAccount)

    render(<AccountsPage />)

    await screen.findByText('Skin Management')
    await screen.findByText('OfflineOnly')
    await screen.findByText('Offline accounts do not have a provider skin page.')

    await waitFor(() => {
      expect((screen.getByRole('button', { name: 'Refresh Preview' }) as HTMLButtonElement).disabled).toBe(true)
      expect((screen.getByRole('button', { name: 'Open Skin Site' }) as HTMLButtonElement).disabled).toBe(true)
    })
  })
})
