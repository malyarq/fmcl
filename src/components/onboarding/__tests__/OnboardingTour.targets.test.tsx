// @vitest-environment jsdom

import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Sidebar, { type SidebarLaunchModel, type SidebarRuntimeModel } from '../../Sidebar'

vi.mock('../../../contexts/SettingsContext', () => ({
  useSettings: () => ({
    getAccentStyles: () => ({ className: '', style: undefined }),
    getAccentHex: () => '#10b981',
    t: (key: string) =>
      ({
        'multiplayer.title': 'Multiplayer',
        'general.settings': 'Settings',
        'sidebar.collapse': 'Collapse sidebar',
        'sidebar.expand': 'Expand sidebar',
        'sidebar.game_settings': 'Game settings',
        'ui_mode.simple': 'Classic',
        'ui_mode.modpacks': 'Modpacks',
        'general.modloader': 'Modloader',
        'general.nickname': 'Nickname',
        'general.play': 'Play',
        'general.running': 'Running',
        'general.offline': 'Offline',
        'modpacks.minecraft_version': 'Minecraft version',
        'forge.enable': 'Forge',
        'fabric.enable': 'Fabric',
        'neoforge.enable': 'NeoForge',
      }[key] ?? key),
    compactMode: false,
    sidebarPosition: 'left',
  }),
  useUIMode: () => ({
    uiMode: 'simple',
    setMode: vi.fn(),
  }),
}))

vi.mock('../../../features/instances/hooks/useInstanceSelectors', () => ({
  useInstanceList: () => ({ status: 'ready', data: [{ id: 'alpha', name: 'Alpha', selected: true }] }),
  useSelectedInstanceId: () => ({ status: 'ready', data: 'alpha' }),
}))

vi.mock('../../../features/launcher/services/launcherService', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../../features/launcher/services/launcherService')>(),
  loadRecentLaunch: vi.fn(() => null),
  formatLastLaunch: vi.fn(() => 'Never'),
}))

function createLaunchModel(): SidebarLaunchModel {
  return {
    nickname: 'Steve',
    setNickname: vi.fn(),
    version: '1.20.1',
    setVersion: vi.fn(),
    versions: [{
      id: '1.20.1',
      type: 'release',
      url: 'https://example.invalid/1.20.1.json',
      time: '2024-01-01T00:00:00Z',
      releaseTime: '2024-01-01T00:00:00Z',
    }],
    useForge: false,
    setUseForge: vi.fn(),
    useFabric: true,
    setUseFabric: vi.fn(),
    useOptiFine: false,
    setUseOptiFine: vi.fn(),
    useNeoForge: false,
    setUseNeoForge: vi.fn(),
    setLoader: vi.fn(),
    isOffline: true,
    currentHint: null,
    supportedVersions: {
      forge: ['1.20.1'],
      fabric: ['1.20.1'],
      optiFine: [],
      neoForge: ['1.20.1'],
    },
    isModloadersLoading: false,
  }
}

function createRuntimeModel(): SidebarRuntimeModel {
  return {
    isLaunching: false,
    progress: 0,
    statusText: '',
    onLaunch: vi.fn(),
  }
}

describe('OnboardingTour target stability', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('keeps every App tour selector mounted in the sidebar shell', () => {
    render(
      <Sidebar
        launch={createLaunchModel()}
        runtime={createRuntimeModel()}
        actions={{
          onShowMultiplayer: vi.fn(),
          onShowSettings: vi.fn(),
        }}
      />
    )

    for (const target of ['classic', 'modpacks', 'settings', 'multiplayer']) {
      expect(document.querySelector(`[data-tour="${target}"]`)).toBeTruthy()
    }
  })
})
