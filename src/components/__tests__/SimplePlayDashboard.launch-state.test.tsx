// @vitest-environment jsdom

import type { ComponentProps } from 'react';
import { readFile } from 'node:fs/promises';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SimplePlayDashboard } from '../SimplePlayDashboard';
import { APP_ICON_PATH } from '../../app/assets/branding';
import { ModpackNavigationProvider } from '../../features/modpacks/navigation/ModpackNavigationProvider';

const setModeMock = vi.fn();
const invalidateInstanceMock = vi.fn();
let effectiveInstanceState: {
  status: 'ready';
  data: {
    id: string;
    snapshot: {
      id: string;
      name: string;
      runtime: { minecraft: string; modLoader?: { type: 'fabric'; version?: string } };
      memory?: { maxMb: number };
    };
  };
};

vi.mock('../../contexts/SettingsContext', () => ({
  useSettings: () => ({
    t: (key: string) =>
      ({
        'ui_mode.simple': 'Classic',
        'general.settings': 'Settings',
        'dashboard.welcome': 'Welcome',
        'dashboard.welcome_title': 'Welcome to FriendLauncher!',
        'dashboard.welcome_desc': 'Simple Play mode is the fastest way to launch Minecraft.',
        'dashboard.dismiss': 'Dismiss',
        'dashboard.quick_actions': 'Quick actions',
        'dashboard.welcome_cta': 'Choose version and nickname in the sidebar, then press Play to start.',
        'dashboard.go_to_modpacks': 'Go to Modpacks',
        'dashboard.info_panel': 'Current settings',
        'dashboard.current_settings': 'Current settings',
        'dashboard.classic_surface_desc': 'Use the sidebar to choose your version, nickname, and launch settings before you play.',
        'dashboard.ram': 'RAM',
        'dashboard.connection': 'Connection',
        'dashboard.advanced_settings': 'Advanced settings',
        'dashboard.content': 'Content',
        'dashboard.launch_status': 'Launch status',
        'modpacks.minecraft_version': 'Minecraft version',
        'general.modloader': 'Modloader',
        'general.offline': 'Offline',
        'status.download_progress': 'Downloading',
      }[key] ?? key),
    getAccentStyles: () => ({ className: '', style: undefined }),
    getAccentHex: () => '#10b981',
    minecraftPath: '/minecraft',
    disableAnimations: false,
  }),
  useUIMode: () => ({
    setMode: (...args: unknown[]) => setModeMock(...args),
  }),
}));

vi.mock('../../features/instances/hooks/useEffectiveInstance', () => ({
  useEffectiveInstance: () => effectiveInstanceState,
}));

vi.mock('../../features/instances/hooks/useInstanceConfigCommands', () => ({
  useInstanceConfigCommands: () => ({
    setMemoryGb: vi.fn(),
    setMinMemoryGb: vi.fn(),
    setVmOptions: vi.fn(),
    setGameExtraArgs: vi.fn(),
    setGameResolution: vi.fn(),
    setAutoConnectServer: vi.fn(),
  }),
}));

vi.mock('../../features/instances/hooks/useInstanceInvalidation', () => ({
  useInstanceInvalidation: () => ({
    invalidateInstance: (...args: unknown[]) => invalidateInstanceMock(...args),
    invalidateInstances: vi.fn(),
  }),
}));

vi.mock('../../features/launcher/hooks/useModSupportedVersions', () => ({
  useModSupportedVersions: () => ({
    forgeVersions: [], fabricVersions: [], neoForgeVersions: [], optiFineVersions: [], isLoading: false,
  }),
}));

vi.mock('../../services/ipc/resourcePacksIPC', () => ({
  resourcePacksIPC: {
    add: vi.fn(),
  },
}));

vi.mock('../../services/ipc/shadersIPC', () => ({
  shadersIPC: {
    add: vi.fn(),
  },
}));

vi.mock('../settings/tabs/GameTab', () => ({
  GameTab: ({ isReadOnly }: { isReadOnly?: boolean }) => (
    <div>{isReadOnly ? 'Game tab (read-only)' : 'Game tab'}</div>
  ),
}));

vi.mock('../modpacks/details/ModsTab', () => ({
  ModsTab: () => <div>Mods tab</div>,
}));

vi.mock('../modpacks/details/ResourcePacksTab', () => ({
  ResourcePacksTab: () => <div>Resource packs tab</div>,
}));

vi.mock('../modpacks/details/ShadersTab', () => ({
  ShadersTab: () => <div>Shaders tab</div>,
}));

vi.mock('../modpacks/details/WorldsTab', () => ({
  WorldsTab: () => <div>Worlds tab</div>,
}));

function renderDashboard(
  runtimeOverrides: Partial<ComponentProps<typeof SimplePlayDashboard>['runtime']> = {},
  launchOverrides: Partial<ComponentProps<typeof SimplePlayDashboard>['launch']> = {},
) {
  return render(
    <ModpackNavigationProvider>
      <SimplePlayDashboard
        launch={{
          version: '1.20.1',
          nickname: 'Steve',
          loaderType: 'fabric',
          ram: 6,
          isOffline: true,
          ...launchOverrides,
        }}
        runtime={{
          isLaunching: false,
          progress: 0,
          launchStage: 'idle',
          statusText: '',
          statusDetail: '',
          onLaunch: vi.fn(),
          ...runtimeOverrides,
        }}
        actions={{
          onShowMultiplayer: vi.fn(),
          onShowSettings: vi.fn(),
        }}
      />
    </ModpackNavigationProvider>,
  );
}

describe('SimplePlayDashboard launch-state seam', () => {
  beforeEach(() => {
    localStorage.clear();
    setModeMock.mockReset();
    invalidateInstanceMock.mockReset();
    invalidateInstanceMock.mockResolvedValue(undefined);
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
    };
    window.matchMedia = vi.fn().mockImplementation(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
    })) as typeof window.matchMedia;
  });

  it('keeps canonical controller ownership in the route and focused behavior in child surfaces', async () => {
    const [dashboard, hero, launchRail, advanced, content] = await Promise.all([
      readFile(`${process.cwd()}/src/components/SimplePlayDashboard.tsx`, 'utf8'),
      readFile(`${process.cwd()}/src/components/simple-play/ClassicHero.tsx`, 'utf8'),
      readFile(`${process.cwd()}/src/components/simple-play/ClassicLaunchRail.tsx`, 'utf8'),
      readFile(`${process.cwd()}/src/components/simple-play/ClassicAdvancedSettings.tsx`, 'utf8'),
      readFile(`${process.cwd()}/src/components/simple-play/ClassicContentTabs.tsx`, 'utf8'),
    ]);

    expect(dashboard).toMatch(/useEffectiveInstance/);
    expect(dashboard).toMatch(/useInstanceConfigCommands/);
    expect(dashboard).not.toMatch(/useModpack\(\)|instancesIPC|metadata/);
    expect(hero).toMatch(/dashboard-launcher-mark/);
    expect(launchRail).toMatch(/ProgressBar/);
    expect(advanced).toMatch(/GameTab/);
    expect(content).toMatch(/ModsTab/);
  });

  it('shows waiting-stage progress and disables route actions while the launcher is busy', () => {
    renderDashboard({
      isLaunching: true,
      progress: undefined,
      launchStage: 'waiting',
      statusText: 'Waiting for Minecraft',
      statusDetail: 'Minecraft process started. Waiting for the game window and logs.',
    });

    expect(screen.getByRole('region', { name: 'Launch status' })).toBeTruthy();
    expect(screen.getAllByText('Waiting for Minecraft').length).toBeGreaterThan(0);
    expect(screen.getByText('Minecraft process started. Waiting for the game window and logs.')).toBeTruthy();
    expect(screen.queryByText('42%')).toBeNull();
    expect(screen.getByText('Game tab (read-only)')).toBeTruthy();

    expect(screen.getByRole('button', { name: 'Settings' })).toHaveProperty('disabled', true);
    screen.getAllByRole('button', { name: 'Go to Modpacks' }).forEach((button) => {
      expect(button).toHaveProperty('disabled', true);
    });
  });

  it('keeps a failed launch visible without showing a misleading progress bar', () => {
    renderDashboard({
      isLaunching: false,
      launchStage: 'failed',
      statusText: 'Launch failed',
      statusDetail: 'Minecraft closed with exit code 1',
    });

    expect(screen.getByText('Launch failed')).toBeTruthy();
    expect(screen.getByText('Minecraft closed with exit code 1')).toBeTruthy();
    expect(screen.queryByText('0%')).toBeNull();
  });

  it('keeps the classic surface oriented around pack context with only the restrained app icon', async () => {
    const { container } = renderDashboard({}, {
      version: '1.12.2',
      loaderType: 'vanilla',
      ram: 2,
    });

    const heroImage = await screen.findByTestId('dashboard-launcher-mark');
    expect(heroImage.getAttribute('data-brand-role')).toBe('app-icon');
    expect(heroImage.getAttribute('src')).toBe(APP_ICON_PATH);
    expect(heroImage.closest('.logo-container')).toBeTruthy();
    expect(container.querySelector('[data-brand-wordmark]')).toBeNull();
    expect(screen.getByText('Classic Pack')).toBeTruthy();
    expect(screen.queryByText('1.12.2')).toBeNull();
    expect(screen.getAllByText(/Fabric/).length).toBeGreaterThan(0);
    expect(screen.queryByText('Vanilla')).toBeNull();
    expect(screen.getByText('Use the sidebar to choose your version, nickname, and launch settings before you play.')).toBeTruthy();
    expect(screen.queryByTestId('app-update-notification')).toBeNull();
    expect(screen.queryByText('Review update')).toBeNull();
    expect(screen.queryByText('Launcher update available')).toBeNull();
    expect(screen.getByText('6 GB')).toBeTruthy();
  });
});
