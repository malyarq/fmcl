// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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
    t: (key: string) => key,
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

    await screen.findByText('accounts.skinTitle')
    await screen.findByText('LittleSkin')

    await waitFor(() => {
      expect(getSkinStateMock).toHaveBeenCalledWith('account-1')
    })
  })

  it('refreshes the provider preview and opens the provider page', async () => {
    render(<AccountsPage />)

    await screen.findByText('LittleSkin')
    const refreshButton = await screen.findByRole('button', { name: 'accounts.skinRefresh' })
    await waitFor(() => {
      expect(refreshButton.hasAttribute('disabled')).toBe(false)
    })
    fireEvent.click(refreshButton)

    await waitFor(() => {
      expect(refreshSkinStateMock).toHaveBeenCalledWith('account-1')
    })

    fireEvent.click(screen.getByRole('button', { name: 'accounts.skinOpenProvider' }))

    await waitFor(() => {
      expect(openExternalMock).toHaveBeenCalledWith({
        url: 'https://littleskin.cn/user',
        context: 'account-skin:account-1',
      })
    })
  })
})
