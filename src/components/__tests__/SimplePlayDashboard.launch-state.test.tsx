// @vitest-environment jsdom

import type { ComponentProps } from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SimplePlayDashboard } from '../SimplePlayDashboard';
import { LAUNCHER_MARK_PATH } from '../../app/assets/branding';

const setModeMock = vi.fn();
const getMetadataMock = vi.fn();

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
}));

vi.mock('../../services/ipc/modpacksIPC', () => ({
  modpacksIPC: {
    resolvePath: vi.fn(),
    getMetadata: (...args: unknown[]) => getMetadataMock(...args),
  },
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

function renderDashboard(runtimeOverrides: Partial<ComponentProps<typeof SimplePlayDashboard>['runtime']> = {}) {
  return render(
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
    />,
  );
}

describe('SimplePlayDashboard launch-state seam', () => {
  beforeEach(() => {
    localStorage.clear();
    setModeMock.mockReset();
    getMetadataMock.mockReset();
    getMetadataMock.mockResolvedValue({
      id: 'classic-pack',
      name: 'Classic Pack',
      source: 'local',
      minecraftVersion: '1.20.1',
      createdAt: '2026-04-14T00:00:00.000Z',
      updatedAt: '2026-04-14T00:00:00.000Z',
    });
    window.matchMedia = vi.fn().mockImplementation(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
    })) as typeof window.matchMedia;
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

  it('renders a branded hero fallback and shared loader label on the classic surface', async () => {
    renderDashboard();

    const heroImage = await screen.findByRole('img', { name: 'Classic Pack artwork' });
    expect(heroImage.getAttribute('src')).toBe(LAUNCHER_MARK_PATH);
    expect(screen.getByText('Classic Pack')).toBeTruthy();
    expect(screen.getAllByText('Fabric').length).toBeGreaterThan(0);
  });
});
