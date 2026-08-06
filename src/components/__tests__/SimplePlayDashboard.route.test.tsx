// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SimplePlayDashboard } from '../SimplePlayDashboard'
import { ModpackNavigationProvider } from '../../features/modpacks/navigation/ModpackNavigationProvider'

const setModeMock = vi.fn()
const showSettingsMock = vi.fn()
const invalidateInstanceMock = vi.fn()
const listModsMock = vi.fn()
const searchModsMock = vi.fn()
const getModVersionsMock = vi.fn()
const installModFileMock = vi.fn()
const registerModMock = vi.fn()
const instanceSnapshotMock = vi.fn()
let effectiveInstanceState: unknown

vi.mock('../../contexts/SettingsContext', () => ({
  useSettings: () => ({
    t: (key: string) =>
      ({
        'ui_mode.simple': 'Classic',
        'general.settings': 'Settings',
        'dashboard.welcome': 'Welcome',
        'dashboard.welcome_title': 'Welcome to FriendLauncher!',
        'dashboard.welcome_desc': 'Simple Play mode is the fastest way to launch Minecraft.',
        'dashboard.dismiss': 'Got it',
        'dashboard.quick_actions': 'Quick actions',
        'dashboard.welcome_cta': 'Choose version and nickname in the sidebar, then press Play to start.',
        'dashboard.go_to_modpacks': 'Go to Modpacks',
        'dashboard.info_panel': 'Current settings',
        'dashboard.current_settings': 'Current settings',
        'dashboard.ram': 'RAM',
        'dashboard.connection': 'Connection',
        'dashboard.advanced_settings': 'Advanced settings',
        'dashboard.content': 'Content',
        'modpacks.minecraft_version': 'Minecraft version',
        'modpacks.tab_mods': 'Mods',
        'modpacks.installed_mods': 'Installed Mods',
        'modpacks.mods_description': 'Manage installed mods',
        'modpacks.add_mod_btn': 'Add Mod',
        'modpacks.update': 'Update',
        'modpacks.no_mods_installed': 'No mods installed',
        'modpacks.mods_empty_hint': 'Add mods from the catalog.',
        'modpacks.add_mod_title': 'Add mods',
        'modpacks.platform_curseforge': 'CurseForge',
        'modpacks.platform_modrinth': 'Modrinth',
        'modpacks.coming_soon_short': 'Soon',
        'modpacks.search_btn': 'Search',
        'modpacks.search_mod_placeholder': 'Search mods...',
        'modpacks.filter_all': 'All versions',
        'modpacks.filter_all_loaders': 'All Modloaders',
        'modpacks.sort': 'Sort',
        'modpacks.sort_popularity': 'Popularity',
        'modpacks.sort_date': 'Date',
        'modpacks.sort_alphabetical': 'Alphabetical',
        'modpacks.loading': 'Loading...',
        'modpacks.add_selected': 'Add selected',
        'modpacks.add_mod': 'Add',
        'modpacks.add_mod_partial_title': 'Some mods still need attention',
        'modpacks.mod_issue_manifest_failure': 'The file was installed, but its manifest entry could not be saved.',
        'operations.retry': 'Retry',
        'general.close_dialog': 'Close dialog',
        'general.cancel': 'Cancel',
        'general.modloader': 'Modloader',
        'general.offline': 'Offline',
      }[key] ?? key),
    getAccentStyles: () => ({ className: '', style: undefined }),
    getAccentHex: () => '#10b981',
    formatNumber: (value: number) => String(value),
    minecraftPath: '/minecraft',
    disableAnimations: false,
  }),
  useUIMode: () => ({
    setMode: (...args: unknown[]) => setModeMock(...args),
  }),
}))

vi.mock('../../features/instances/hooks/useEffectiveInstance', () => ({
  useEffectiveInstance: () => effectiveInstanceState,
}))

vi.mock('../../features/instances/hooks/useInstanceConfigCommands', () => ({
  useInstanceConfigCommands: () => ({
    setMemoryGb: vi.fn(),
    setMinMemoryGb: vi.fn(),
    setVmOptions: vi.fn(),
    setGameExtraArgs: vi.fn(),
    setGameResolution: vi.fn(),
    setAutoConnectServer: vi.fn(),
  }),
}))

vi.mock('../../features/instances/hooks/useInstanceInvalidation', () => ({
  useInstanceInvalidation: () => ({
    invalidateInstance: (...args: unknown[]) => invalidateInstanceMock(...args),
    invalidateInstances: vi.fn(),
  }),
}))

vi.mock('../../services/ipc/resourcePacksIPC', () => ({
  resourcePacksIPC: {
    add: vi.fn(),
  },
}))

vi.mock('../../services/ipc/shadersIPC', () => ({
  shadersIPC: {
    add: vi.fn(),
  },
}))

vi.mock('../../services/ipc/instancesIPC', () => ({
  instancesIPC: {
    snapshot: (...args: unknown[]) => instanceSnapshotMock(...args),
  },
}))

vi.mock('../../services/ipc/instanceModsIPC', () => ({
  instanceModsIPC: {
    list: (...args: unknown[]) => listModsMock(...args),
    remove: vi.fn(),
    setEnabled: vi.fn(),
    register: (...args: unknown[]) => registerModMock(...args),
  },
}))

vi.mock('../../services/ipc/modsIPC', () => ({
  modsIPC: {
    searchMods: (...args: unknown[]) => searchModsMock(...args),
    getModVersions: (...args: unknown[]) => getModVersionsMock(...args),
    installModFile: (...args: unknown[]) => installModFileMock(...args),
  },
}))

vi.mock('../../services/ipc/externalLinksIPC', () => ({
  externalLinksIPC: { open: vi.fn() },
}))

vi.mock('../../contexts/ConfirmContext', () => ({
  useConfirm: () => ({ confirm: vi.fn().mockResolvedValue(false) }),
}))

vi.mock('../../contexts/ToastContext', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}))

vi.mock('../settings/tabs/GameTab', () => ({
  GameTab: () => <div>Game tab</div>,
}))

vi.mock('../../features/launcher/hooks/useModSupportedVersions', () => ({
  useModSupportedVersions: () => ({
    forgeVersions: [], fabricVersions: [], neoForgeVersions: [], optiFineVersions: [], isLoading: false,
  }),
}))

vi.mock('../modpacks/details/ResourcePacksTab', () => ({
  ResourcePacksTab: () => <div>Resource packs tab</div>,
}))

vi.mock('../modpacks/details/ShadersTab', () => ({
  ShadersTab: () => <div>Shaders tab</div>,
}))

vi.mock('../modpacks/details/WorldsTab', () => ({
  WorldsTab: () => <div>Worlds tab</div>,
}))

describe('SimplePlayDashboard route flow', () => {
  beforeEach(() => {
    localStorage.clear()
    setModeMock.mockReset()
    showSettingsMock.mockReset()
    invalidateInstanceMock.mockReset()
    listModsMock.mockReset()
    searchModsMock.mockReset()
    getModVersionsMock.mockReset()
    installModFileMock.mockReset()
    registerModMock.mockReset()
    instanceSnapshotMock.mockReset()
    listModsMock.mockResolvedValue([])
    searchModsMock.mockResolvedValue({
      items: [{ platform: 'modrinth', projectId: 'sodium', title: 'Sodium' }],
      total: 1,
    })
    getModVersionsMock.mockResolvedValue([{
      platform: 'modrinth', versionId: 'sodium-version', name: '1.0.0', mcVersions: ['1.20.1'], loaders: ['fabric'],
    }])
    installModFileMock.mockResolvedValue({ status: 'success', issues: [] })
    registerModMock.mockRejectedValue(new Error('manifest unavailable'))
    instanceSnapshotMock.mockResolvedValue({
      ok: true,
      value: {
        id: 'classic-pack',
        name: 'Classic Pack',
        metadata: {
          source: 'local',
          createdAt: '2026-08-04T00:00:00.000Z',
          updatedAt: '2026-08-04T00:00:00.000Z',
        },
        config: {
          runtime: { minecraftVersion: '1.20.1', modLoader: { type: 'fabric', version: '0.16.9' } },
          memory: { maxMb: 6144 },
        },
        summary: { minecraftVersion: '1.20.1', modLoader: { type: 'fabric', version: '0.16.9' } },
      },
    })
    invalidateInstanceMock.mockResolvedValue(undefined)
    effectiveInstanceState = {
      status: 'ready',
      data: {
        id: 'classic-pack',
        snapshot: {
          id: 'classic-pack',
          name: 'Classic Pack',
          runtime: { minecraft: '1.20.1', modLoader: { type: 'fabric', version: '0.16.9' } },
          memory: { maxMb: 6144 },
        },
      },
    }
    window.matchMedia = vi.fn().mockImplementation(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
    })) as typeof window.matchMedia
  })

  it('shows route-level quick actions and lets users jump to settings or modpacks', () => {
    render(
      <ModpackNavigationProvider><SimplePlayDashboard
        launch={{
          version: '1.20.1',
          nickname: 'Steve',
          loaderType: 'fabric',
          ram: 6,
          isOffline: true,
        }}
        runtime={{
          isLaunching: false,
          onLaunch: vi.fn(),
        }}
        actions={{
          onShowMultiplayer: vi.fn(),
          onShowSettings: showSettingsMock,
        }}
      /></ModpackNavigationProvider>
    )

    expect(screen.getByRole('heading', { name: 'Welcome to FriendLauncher!' })).toBeTruthy()
    expect(screen.getByText('Choose version and nickname in the sidebar, then press Play to start.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Got it' }).className).toContain('whitespace-nowrap')

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    expect(showSettingsMock).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getAllByRole('button', { name: 'Go to Modpacks' })[0])
    expect(setModeMock).toHaveBeenCalledWith('modpacks')

    fireEvent.click(screen.getByRole('button', { name: 'Got it' }))
    expect(screen.queryByRole('heading', { name: 'Welcome to FriendLauncher!' })).toBeNull()
  })

  it('keeps canonical loading and failure states visible with an in-place retry', async () => {
    effectiveInstanceState = { status: 'error', error: { code: 'INSTANCE_UNAVAILABLE', message: 'Classic unavailable' } }

    render(
      <ModpackNavigationProvider><SimplePlayDashboard
        launch={{ version: '1.20.1', nickname: 'Steve', loaderType: 'fabric', ram: 6, isOffline: true }}
        runtime={{ isLaunching: false, onLaunch: vi.fn() }}
        actions={{ onShowMultiplayer: vi.fn(), onShowSettings: vi.fn() }}
      /></ModpackNavigationProvider>,
    )

    const failure = screen.getByTestId('classic-dashboard-error')
    expect(failure.getAttribute('role')).toBe('alert')
    expect(failure.textContent).toContain('Classic unavailable')

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(invalidateInstanceMock).toHaveBeenCalledWith('classic'))
  })

  it('keeps the real classic ModsTab modal focused, closable and recoverable after a partial commit', async () => {
    render(
      <ModpackNavigationProvider><SimplePlayDashboard
        launch={{ version: '1.20.1', nickname: 'Steve', loaderType: 'fabric', ram: 6, isOffline: true }}
        runtime={{ isLaunching: false, onLaunch: vi.fn() }}
        actions={{ onShowMultiplayer: vi.fn(), onShowSettings: vi.fn() }}
      /></ModpackNavigationProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Content' }))
    const addButton = await screen.findByRole('button', { name: 'Add Mod' })
    addButton.focus()
    fireEvent.click(addButton)
    expect(await screen.findByRole('dialog', { name: 'Add mods' })).toBeTruthy()

    const checkbox = await screen.findByRole('checkbox', { name: 'Sodium' })
    fireEvent.click(checkbox)
    const install = await screen.findByRole('button', { name: 'Add selected (1)' })
    fireEvent.click(install)

    const notice = await screen.findByRole('status', { name: 'Some mods still need attention' })
    expect(notice.getAttribute('data-acquisition-committed')).toBe('true')
    expect(screen.getByRole('dialog', { name: 'Add mods' })).toBeTruthy()
    expect(listModsMock).toHaveBeenCalledTimes(2)

    await waitFor(() => expect(screen.getByRole('button', { name: 'Close dialog' })).toHaveProperty('disabled', false))
    await new Promise((resolve) => window.setTimeout(resolve, 0))
    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Add mods' })).toBeNull())
    await waitFor(() => expect(document.activeElement).toBe(addButton))
  })
})
