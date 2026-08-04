// @vitest-environment jsdom

import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Sidebar, { type SidebarLaunchModel, type SidebarRuntimeModel } from '../Sidebar';
import {
  getPrimaryActionOwnershipForView,
  setModpackPrimaryActionOwnership,
} from '../modpacks/primaryActionOwnership';

let currentUIMode: 'simple' | 'modpacks' = 'modpacks';

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
    uiMode: currentUIMode,
    setMode: vi.fn(),
  }),
}));

vi.mock('../../features/instances/hooks/useInstanceSelectors', () => ({
  useInstanceList: () => ({ status: 'ready', data: [{ id: 'alpha', name: 'Alpha', selected: true }] }),
  useSelectedInstanceId: () => ({ status: 'ready', data: 'alpha' }),
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
  LaunchControls: ({ priority = 'primary' }: { priority?: 'primary' | 'secondary' }) => (
    <div data-testid="launch-controls" data-launch-priority={priority}>
      Launch controls
    </div>
  ),
}));

vi.mock('../sidebar/ModloaderSection', () => ({
  ModloaderSection: () => <div>Modloader section</div>,
}));

vi.mock('../sidebar/OptifineToggle', () => ({
  OptifineToggle: () => <div>Optifine toggle</div>,
}));

vi.mock('../ui/Select', () => ({
  Select: () => <select />,
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
    statusText: '',
    onLaunch: vi.fn(),
  };
}

describe('Sidebar primary-action ownership', () => {
  beforeEach(() => {
    currentUIMode = 'modpacks';
    localStorage.clear();
    setModpackPrimaryActionOwnership('shell');
  });

  it.each([
    ['list', { type: 'list' }],
    ['browser', { type: 'browser', state: { platform: 'modrinth', query: '', sortBy: 'popularity', filterMCVersion: 'all', filterLoader: 'all', currentPage: 1, itemsPerPage: 12, showHistory: false } }],
    ['details', { type: 'details', modpackId: 'alpha' }],
    ['create', { type: 'create' }],
    ['addMod', { type: 'addMod', modpackId: 'alpha' }],
    ['addResourcePack', { type: 'addResourcePack', modpackId: 'alpha' }],
    ['addShader', { type: 'addShader', modpackId: 'alpha' }],
    ['export', { type: 'export', modpackId: 'alpha' }],
    ['install', { type: 'install', modpack: { projectId: 'alpha' }, versions: [], platform: 'modrinth' }],
    ['importPreview', { type: 'importPreview', filePath: '/tmp/alpha.zip' }],
  ] as const)('classifies %s views through the shared ownership matrix', (_label, view) => {
    const expected = ['list', 'browser'].includes(view.type) ? 'shell' : 'route';
    expect(getPrimaryActionOwnershipForView(view as Parameters<typeof getPrimaryActionOwnershipForView>[0])).toBe(expected);
  });

  it('keeps shell launch primary on shell-owned modpack surfaces', () => {
    setModpackPrimaryActionOwnership('shell');

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

    expect(screen.getByTestId('launch-controls').getAttribute('data-launch-priority')).toBe('primary');
  });

  it('demotes shell launch on route-owned modpack surfaces', () => {
    setModpackPrimaryActionOwnership('route');

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

    expect(screen.getByTestId('launch-controls').getAttribute('data-launch-priority')).toBe('secondary');
  });

  it('keeps classic launcher-home shell-owned even if the modpack seam is route-owned', () => {
    currentUIMode = 'simple';
    setModpackPrimaryActionOwnership('route');

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

    expect(screen.getByTestId('launch-controls').getAttribute('data-launch-priority')).toBe('primary');
  });
});
