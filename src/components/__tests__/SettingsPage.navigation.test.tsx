// @vitest-environment jsdom

import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SettingsPage from '../SettingsPage'

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
        'settings.tab_appearance': 'Appearance',
        'settings.tab_downloads': 'Downloads',
        'settings.tab_launcher': 'Launcher',
      }[key] ?? key),
    minecraftPath: '/minecraft',
    setMinecraftPath: vi.fn(),
    autoDownloadThreads: true,
    setAutoDownloadThreads: vi.fn(),
    downloadThreads: 8,
    setDownloadThreads: vi.fn(),
    maxSockets: 16,
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

vi.mock('../../features/accounts/AccountsPage', () => ({
  AccountsPage: () => <div>Accounts tab</div>,
}))

vi.mock('../../features/settings/statistics/StatisticsTab', () => ({
  StatisticsTab: () => <div>Statistics tab</div>,
}))

vi.mock('../UpdateModal', () => ({
  UpdateModal: () => null,
}))

vi.mock('../../services/ipc/modpacksIPC', () => ({
  modpacksIPC: {},
}))

describe('SettingsPage navigation', () => {
  beforeEach(() => {
    onCloseMock.mockReset()

    window.matchMedia = vi.fn().mockImplementation(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
    })) as typeof window.matchMedia
  })

  it('keeps tab semantics while leaving shell summaries out of the header chrome', async () => {
    const { container } = render(<SettingsPage onClose={onCloseMock} />)
    const header = screen.getByTestId('settings-shell-header')

    expect(screen.getByRole('tablist', { name: 'Launcher Settings' })).toBeTruthy()
    expect(screen.getAllByRole('tab')).toHaveLength(6)
    expect(screen.getByRole('tabpanel', { name: 'Appearance' })).toBeTruthy()
    expect(within(header).queryByText('Apply a ready-made visual profile, or import/export your own configuration.')).toBeNull()

    fireEvent.click(screen.getByRole('tab', { name: 'Downloads' }))
    expect(await screen.findByRole('tabpanel', { name: 'Downloads' })).toBeTruthy()
    expect(screen.getByText('Downloads tab')).toBeTruthy()
    expect(within(header).queryByText('Tune mirrors, concurrency, and connection limits for a stable download pipeline.')).toBeNull()

    fireEvent.click(screen.getByRole('tab', { name: 'Launcher' }))
    expect(await screen.findByRole('tabpanel', { name: 'Launcher' })).toBeTruthy()
    expect(screen.getByText('Launcher tab')).toBeTruthy()
    expect(within(header).queryByText('Manage runtime behavior, update checks, and persistent launcher caches from one place.')).toBeNull()

    fireEvent.click(screen.getByRole('tab', { name: 'Storage' }))
    expect(await screen.findByRole('tabpanel', { name: 'Storage' })).toBeTruthy()
    expect(screen.getByText('Storage tab')).toBeTruthy()
    expect(within(header).queryByText('Review shared content usage and run cleanup without digging through extra utility panels.')).toBeNull()

    fireEvent.click(screen.getByRole('tab', { name: 'Accounts' }))
    expect(await screen.findByRole('tabpanel', { name: 'Accounts' })).toBeTruthy()
    expect(screen.getByText('Accounts tab')).toBeTruthy()
    expect(within(header).queryByText('Keep your launch-ready accounts, provider access, and skin tools in one place.')).toBeNull()

    fireEvent.click(screen.getByRole('tab', { name: 'Statistics' }))
    expect(await screen.findByRole('tabpanel', { name: 'Statistics' })).toBeTruthy()
    expect(screen.getByText('Statistics tab')).toBeTruthy()
    expect(within(header).queryByText('Keep the most useful launch and play-time trends visible without opening extra sections.')).toBeNull()

    expect(container.textContent).not.toContain('settings.tab_storage')
    expect(container.textContent).not.toContain('settings.storage.description')
    expect(container.textContent).not.toContain('settings.tab_accounts')
    expect(container.textContent).not.toContain('accounts.description')
    expect(container.textContent).not.toContain('settings.tab_statistics')
    expect(container.textContent).not.toContain('stats.description')

    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(onCloseMock).toHaveBeenCalledTimes(1)
  })
})
