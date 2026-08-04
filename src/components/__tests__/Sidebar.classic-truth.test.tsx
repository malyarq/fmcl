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
        'sidebar.game_settings': 'Game settings',
        'sidebar.current_runtime': 'Current runtime',
        'modpacks.minecraft_version': 'Minecraft version',
        'general.modloader': 'Modloader',
        'modpacks.loader_vanilla': 'Vanilla',
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
    modpacks: [{ id: 'classic-pack' }],
    selectedId: 'classic-pack',
    effectiveModpackId: 'classic-pack',
  }),
}));

vi.mock('../../features/launcher/services/launcherService', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../features/launcher/services/launcherService')>(),
  loadRecentLaunch: vi.fn(() => null),
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
    versions: [
      {
        id: '1.20.1',
        type: 'release',
        url: 'https://example.invalid/1.20.1.json',
        time: '2026-04-20T00:00:00.000Z',
        releaseTime: '2026-04-20T00:00:00.000Z',
      },
    ],
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
    statusText: '',
    onLaunch: vi.fn(),
  };
}

describe('Sidebar classic truth seam', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('shows the persisted classic runtime with short vanilla wording on cold start', () => {
    render(
      <Sidebar
        launch={createLaunchModel()}
        runtime={createRuntimeModel()}
        actions={{
          onShowMultiplayer: vi.fn(),
          onShowSettings: vi.fn(),
        }}
      />,
    );

    expect(screen.getByDisplayValue('1.20.1')).toBeTruthy();
    expect(screen.getByText('Current runtime')).toBeTruthy();
    expect(screen.getByTestId('sidebar-classic-runtime-summary').textContent).toContain('1.20.1 • Vanilla');
    expect(screen.queryByText('1.12.2')).toBeNull();
    expect(screen.queryByText('Vanilla (no modloader)')).toBeNull();
  });
});
