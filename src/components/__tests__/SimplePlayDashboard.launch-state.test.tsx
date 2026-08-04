// @vitest-environment jsdom

import type { ComponentProps } from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SimplePlayDashboard } from '../SimplePlayDashboard';
import { APP_ICON_PATH } from '../../app/assets/branding';

const setModeMock = vi.fn();
const snapshotMock = vi.fn();

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
  }),
}));

vi.mock('../../services/ipc/instancesIPC', () => ({
  instancesIPC: {
    snapshot: (...args: unknown[]) => snapshotMock(...args),
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
    snapshotMock.mockReset();
    snapshotMock.mockResolvedValue({
      ok: true,
      value: {
        id: 'classic-pack',
        name: 'Classic Pack',
        metadata: {
          source: 'local',
          createdAt: '2026-04-14T00:00:00.000Z',
          updatedAt: '2026-04-14T00:00:00.000Z',
        },
        config: {
          runtime: { minecraftVersion: '1.20.1' },
        },
        summary: {
          minecraftVersion: '1.20.1',
          modLoader: { type: 'fabric' },
        },
      },
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

  it('keeps the classic surface oriented around pack context with only the restrained app icon', async () => {
    const { container } = renderDashboard();

    const heroImage = await screen.findByTestId('dashboard-launcher-mark');
    expect(heroImage.getAttribute('data-brand-role')).toBe('app-icon');
    expect(heroImage.getAttribute('src')).toBe(APP_ICON_PATH);
    expect(heroImage.closest('.logo-container')).toBeTruthy();
    expect(container.querySelector('[data-brand-wordmark]')).toBeNull();
    expect(screen.getByText('Classic Pack')).toBeTruthy();
    expect(screen.queryByText('1.12.2')).toBeNull();
    expect(screen.getAllByText('Fabric').length).toBeGreaterThan(0);
    expect(screen.queryByText('Vanilla')).toBeNull();
    expect(screen.getByText('Use the sidebar to choose your version, nickname, and launch settings before you play.')).toBeTruthy();
    expect(screen.queryByTestId('app-update-notification')).toBeNull();
    expect(screen.queryByText('Review update')).toBeNull();
    expect(screen.queryByText('Launcher update available')).toBeNull();
    expect(snapshotMock).toHaveBeenCalledWith({ id: 'classic-pack' });
  });
});
