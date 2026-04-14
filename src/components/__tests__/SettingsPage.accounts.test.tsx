// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SettingsPage from '../SettingsPage'

const getAccountsMock = vi.fn()
const getSelectedAccountMock = vi.fn()
const getSkinStateMock = vi.fn()
const onCloseMock = vi.fn()

vi.mock('../../contexts/SettingsContext', () => ({
  useSettings: () => ({
    hideLauncher: false,
    setHideLauncher: vi.fn(),
    showConsole: false,
    setShowConsole: vi.fn(),
    t: (key: string) =>
      ({
        'settings.title': 'Launcher Settings',
        'settings.done': 'Done',
        'settings.doneHint': 'Changes are saved automatically as you work.',
        'settings.tab_appearance': 'Appearance',
        'settings.tab_downloads': 'Downloads',
        'settings.tab_launcher': 'Launcher',
        'settings.tab_storage': 'Storage',
        'settings.tab_accounts': 'Accounts',
        'settings.tab_statistics': 'Statistics',
        'accounts.title': 'Accounts',
        'accounts.description': 'Manage your Minecraft accounts and switch between them.',
        'accounts.activeAccount': 'Current account',
        'accounts.addAccount': 'Add Account',
        'accounts.active': 'Active',
        'accounts.savedCountLabel': 'Saved accounts',
        'accounts.typeThirdParty': 'Third Party',
        'accounts.skinTitle': 'Skin Management',
        'accounts.skinManageHint': 'Refresh the preview or open the provider site to change skins.',
        'accounts.skinRefresh': 'Refresh Preview',
        'accounts.skinOpenProvider': 'Open Skin Site',
        'accounts.providerSupportHint': 'Blessing Skin and LittleSkin are supported for provider-aware skin management.',
      }[key] ?? key),
    minecraftPath: '/minecraft',
    setMinecraftPath: vi.fn(),
    autoDownloadThreads: 4,
    setAutoDownloadThreads: vi.fn(),
    downloadThreads: 4,
    setDownloadThreads: vi.fn(),
    maxSockets: 8,
    setMaxSockets: vi.fn(),
    getAccentStyles: () => ({ className: '', style: undefined }),
  }),
}))

vi.mock('../../features/updater/hooks/useAppUpdater', () => ({
  useAppUpdater: () => ({
    status: 'idle',
    updateInfo: null,
    progress: 0,
    checkForUpdates: vi.fn(),
    installUpdate: vi.fn(),
  }),
}))

vi.mock('../settings/tabs/AppearanceTab', () => ({
  AppearanceTab: () => <div>Appearance tab</div>,
}))

vi.mock('../settings/tabs/DownloadsTab', () => ({
  DownloadsTab: () => <div>Downloads tab</div>,
}))

vi.mock('../settings/tabs/LauncherTab', () => ({
  LauncherTab: () => <div>Launcher tab</div>,
}))

vi.mock('../settings/tabs/StorageTab', () => ({
  StorageSettings: () => <div>Storage tab</div>,
}))

vi.mock('../../features/settings/statistics/StatisticsTab', () => ({
  StatisticsTab: () => <div>Statistics tab</div>,
}))

vi.mock('../UpdateModal', () => ({
  UpdateModal: () => null,
}))

vi.mock('../../contexts/ConfirmContext', () => ({
  useConfirm: () => ({
    confirm: vi.fn(),
  }),
}))

vi.mock('../../contexts/ToastContext', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
  }),
}))

vi.mock('../../services/ipc/modpacksIPC', () => ({
  modpacksIPC: {},
}))

vi.mock('../../services/ipc/externalLinksIPC', () => ({
  externalLinksIPC: {
    open: vi.fn(),
  },
}))

vi.mock('../../services/ipc/accountIPC', () => ({
  accountIPC: {
    getAccounts: (...args: unknown[]) => getAccountsMock(...args),
    getSelectedAccount: (...args: unknown[]) => getSelectedAccountMock(...args),
    getSkinState: (...args: unknown[]) => getSkinStateMock(...args),
    refreshSkinState: vi.fn(),
    selectAccount: vi.fn(),
    removeAccount: vi.fn(),
    addOfflineAccount: vi.fn(),
    addThirdPartyAccount: vi.fn(),
  },
}))

describe('SettingsPage accounts route', () => {
  beforeEach(() => {
    onCloseMock.mockReset()
    getAccountsMock.mockReset()
    getSelectedAccountMock.mockReset()
    getSkinStateMock.mockReset()

    window.matchMedia = vi.fn().mockImplementation(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
    })) as typeof window.matchMedia

    const account = {
      id: 'account-1',
      type: 'third-party',
      name: 'PlayerOne',
      authServerUrl: 'https://littleskin.cn/api/yggdrasil',
      skinProvider: 'littleskin',
      avatar: 'https://littleskin.cn/avatar/player/64/PlayerOne.png',
    }

    getAccountsMock.mockResolvedValue([account])
    getSelectedAccountMock.mockResolvedValue(account)
    getSkinStateMock.mockResolvedValue({
      supported: true,
      provider: 'littleskin',
      providerLabel: 'LittleSkin',
      avatarUrl: 'https://littleskin.cn/avatar/player/64/PlayerOne.png',
      manageUrl: 'https://littleskin.cn/user',
    })
  })

  it('switches from settings tabs into the real accounts route and keeps the modal close action available', async () => {
    render(<SettingsPage onClose={onCloseMock} />)

    fireEvent.click(screen.getByRole('tab', { name: 'Accounts' }))

    const panel = await screen.findByRole('tabpanel', { name: 'Accounts' })
    expect(panel).toBeTruthy()
    expect(await screen.findByRole('heading', { name: 'Accounts' })).toBeTruthy()
    expect(screen.getByText('Current account')).toBeTruthy()
    expect(screen.getByText('Blessing Skin and LittleSkin are supported for provider-aware skin management.')).toBeTruthy()
    expect(await screen.findByText('Skin Management')).toBeTruthy()

    await waitFor(() => {
      expect(getSkinStateMock).toHaveBeenCalledWith('account-1')
    })

    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(onCloseMock).toHaveBeenCalledTimes(1)
  })
})
