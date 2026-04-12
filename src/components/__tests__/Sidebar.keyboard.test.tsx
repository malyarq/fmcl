// @vitest-environment jsdom

import type { ReactNode, SelectHTMLAttributes } from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Sidebar, { type SidebarLaunchModel, type SidebarRuntimeModel } from '../Sidebar';

vi.mock('../../contexts/SettingsContext', () => ({
  useSettings: () => ({
    getAccentStyles: () => ({ className: '', style: undefined }),
    getAccentHex: () => '#10b981',
    t: (key: string) =>
      ({
        'multiplayer.title': 'Multiplayer',
        'general.settings': 'Settings',
        'sidebar.collapse': 'Collapse sidebar',
        'sidebar.game_settings': 'Game settings',
      }[key] ?? key),
    compactMode: false,
    sidebarPosition: 'left',
  }),
  useUIMode: () => ({
    uiMode: 'simple',
    setMode: vi.fn(),
  }),
}));

vi.mock('../../contexts/ModpackContext', () => ({
  useModpack: () => ({
    modpacks: [{ id: 'alpha' }],
    selectedId: 'alpha',
    effectiveModpackId: 'alpha',
  }),
}));

vi.mock('../../features/launch/services/lastGame', () => ({
  loadLastGame: vi.fn(() => null),
  formatLastLaunch: vi.fn(() => 'Never'),
}));

vi.mock('../sidebar/SidebarHeader', () => ({
  SidebarHeader: () => <div>Sidebar header</div>,
}));

vi.mock('../sidebar/NicknameSection', () => ({
  NicknameSection: () => <div>Nickname section</div>,
}));

vi.mock('../sidebar/LaunchControls', () => ({
  LaunchControls: () => <div>Launch controls</div>,
}));

vi.mock('../sidebar/ModloaderSection', () => ({
  ModloaderSection: () => <div>Modloader section</div>,
}));

vi.mock('../sidebar/OptifineToggle', () => ({
  OptifineToggle: () => <div>Optifine toggle</div>,
}));

vi.mock('../ui/Select', () => ({
  Select: (props: SelectHTMLAttributes<HTMLSelectElement>) => <select {...props} />,
}));

vi.mock('../ui/Tooltip', () => ({
  Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

function createLaunchModel(): SidebarLaunchModel {
  return {
    nickname: 'Steve',
    setNickname: vi.fn(),
    version: '1.20.1',
    setVersion: vi.fn(),
    versions: [],
    useForge: false,
    setUseForge: vi.fn(),
    useFabric: false,
    setUseFabric: vi.fn(),
    useOptiFine: false,
    setUseOptiFine: vi.fn(),
    useNeoForge: false,
    setUseNeoForge: vi.fn(),
    setLoader: vi.fn(),
    isOffline: true,
    currentHint: null,
    supportedVersions: {
      forge: [],
      fabric: [],
      optiFine: [],
      neoForge: [],
    },
    isModloadersLoading: false,
  };
}

function createRuntimeModel(): SidebarRuntimeModel {
  return {
    isLaunching: false,
    progress: 0,
    statusText: 'Launching...',
    onLaunch: vi.fn(),
  };
}

describe('Sidebar accessibility', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('exposes the collapsed shell actions with accessible names and a live region', () => {
    localStorage.setItem('sidebar_collapsed', 'true');

    render(
      <Sidebar
        launch={createLaunchModel()}
        runtime={createRuntimeModel()}
        actions={{
          onShowMultiplayer: vi.fn(),
          onShowSettings: vi.fn(),
        }}
      />
    );

    expect(screen.getByRole('complementary', { name: 'FriendLauncher sidebar' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Multiplayer' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Settings' })).toBeTruthy();
    expect(screen.getByText('Launching...')).toBeTruthy();
  });

  it('wires the collapse control with expanded state and content ownership', () => {
    render(
      <Sidebar
        launch={createLaunchModel()}
        runtime={createRuntimeModel()}
        actions={{
          onShowMultiplayer: vi.fn(),
          onShowSettings: vi.fn(),
        }}
      />
    );

    const collapseButton = screen.getByRole('button', { name: /Collapse sidebar/i });

    expect(collapseButton.getAttribute('aria-controls')).toBe('launcher-sidebar-content');
    expect(collapseButton.getAttribute('aria-expanded')).toBe('true');
  });
});
