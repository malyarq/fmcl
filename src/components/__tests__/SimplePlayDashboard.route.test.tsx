// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SimplePlayDashboard } from '../SimplePlayDashboard'

const setModeMock = vi.fn()
const showSettingsMock = vi.fn()

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
        'general.modloader': 'Modloader',
        'general.offline': 'Offline',
      }[key] ?? key),
    getAccentStyles: () => ({ className: '', style: undefined }),
    getAccentHex: () => '#10b981',
    minecraftPath: '/minecraft',
    disableAnimations: false,
  }),
  useUIMode: () => ({
    setMode: (...args: unknown[]) => setModeMock(...args),
  }),
}))

vi.mock('../../contexts/ModpackContext', () => ({
  useModpack: () => ({
    effectiveModpackId: 'classic-pack',
    config: { runtime: { minecraft: '1.20.1' } },
    setMemoryGb: vi.fn(),
    setMinMemoryGb: vi.fn(),
    setJavaPath: vi.fn(),
    setVmOptions: vi.fn(),
    setGameExtraArgs: vi.fn(),
    setGameResolution: vi.fn(),
    setAutoConnectServer: vi.fn(),
    modpacks: [{ id: 'classic-pack', path: '/minecraft' }],
  }),
}))

vi.mock('../../services/ipc/modpacksIPC', () => ({
  modpacksIPC: {
    resolvePath: vi.fn(),
  },
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

vi.mock('../settings/tabs/GameTab', () => ({
  GameTab: () => <div>Game tab</div>,
}))

vi.mock('../modpacks/details/ModsTab', () => ({
  ModsTab: () => <div>Mods tab</div>,
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
      <SimplePlayDashboard
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
      />
    )

    expect(screen.getByRole('heading', { name: 'Welcome to FriendLauncher!' })).toBeTruthy()
    expect(screen.getByText('Choose version and nickname in the sidebar, then press Play to start.')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    expect(showSettingsMock).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getAllByRole('button', { name: 'Go to Modpacks' })[0])
    expect(setModeMock).toHaveBeenCalledWith('modpacks')

    fireEvent.click(screen.getByRole('button', { name: 'Got it' }))
    expect(screen.queryByRole('heading', { name: 'Welcome to FriendLauncher!' })).toBeNull()
  })
})
