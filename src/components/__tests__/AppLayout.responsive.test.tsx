// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppLayout, type AppLayoutProps } from '../AppLayout';

const uiModeState = { value: 'simple' as 'simple' | 'modpacks' };
const settingsState = { sidebarPosition: 'left' as 'left' | 'right' };

vi.mock('../../contexts/SettingsContext', () => ({
  useUIMode: () => ({
    uiMode: uiModeState.value,
  }),
  useSettings: () => ({
    sidebarPosition: settingsState.sidebarPosition,
  }),
}));

vi.mock('../layout/BackgroundLayer', () => ({
  BackgroundLayer: () => <div>Background layer</div>,
}));

vi.mock('../TitleBar', () => ({
  default: () => <div>Title bar</div>,
}));

vi.mock('../Sidebar', () => ({
  default: () => <aside>Sidebar</aside>,
}));

vi.mock('../UpdateNotification', () => ({
  UpdateNotification: () => <div>Update notification</div>,
}));

vi.mock('../modpacks/ModpackUpdateNotification', () => ({
  ModpackUpdateNotification: () => <div>Modpack update notification</div>,
}));

vi.mock('../modpacks/ModpackRouter', () => ({
  ModpackRouter: () => <div>Modpack router</div>,
}));

vi.mock('../SimplePlayDashboard', () => ({
  SimplePlayDashboard: () => <div>Simple play dashboard</div>,
}));

vi.mock('../SettingsPage', () => ({
  default: () => <div>Settings page</div>,
}));

vi.mock('../MultiplayerPage', () => ({
  default: () => <div>Multiplayer page</div>,
}));

function createProps(): AppLayoutProps {
  return {
    theme: 'light',
    updates: {
      status: 'idle',
      info: null,
      onInstall: vi.fn(),
    },
    modpackUpdates: {
      updates: [],
      onDismiss: vi.fn(),
    },
    overlays: {
      showSettings: false,
      onCloseSettings: vi.fn(),
      showMultiplayer: false,
      onBackFromMultiplayer: vi.fn(),
    },
    actions: {
      onShowMultiplayer: vi.fn(),
      onShowSettings: vi.fn(),
    },
    launch: {
      nickname: 'Steve',
      setNickname: vi.fn(),
      version: '1.20.1',
      setVersion: vi.fn(),
      versions: [],
      useForge: false,
      setUseForge: vi.fn(),
      useFabric: false,
      setUseFabric: vi.fn(),
      useNeoForge: false,
      setUseNeoForge: vi.fn(),
      setLoader: vi.fn(),
      useOptiFine: false,
      setUseOptiFine: vi.fn(),
      isOffline: true,
      currentHint: null,
      loaderType: 'vanilla',
      ram: 4,
      supportedVersions: {
        forge: [],
        fabric: [],
        optiFine: [],
        neoForge: [],
      },
      isModloadersLoading: false,
    },
    runtime: {
      isLaunching: false,
      progress: 0,
      launchStage: 'idle',
      statusText: '',
      statusDetail: '',
      canForceRestart: false,
      onLaunch: vi.fn(),
      showConsole: false,
      logs: [],
      logEndRef: { current: document.createElement('div') },
      onCopyLogs: vi.fn(),
      iconPath: '/icon.png',
    },
  };
}

describe('AppLayout responsive shell', () => {
  beforeEach(() => {
    uiModeState.value = 'simple';
    settingsState.sidebarPosition = 'left';
  });

  it('renders the adaptive shell frame and main content contract', () => {
    render(<AppLayout {...createProps()} />);

    const shellFrame = screen.getByTestId('app-shell-frame');
    const main = screen.getByTestId('app-layout-main');
    const split = screen.getByTestId('app-layout-split');

    expect(shellFrame.className).toContain('min-w-0');
    expect(shellFrame.className).toContain('sm:rounded-[28px]');
    expect(main.className).toContain('min-w-0');
    expect(split.className).toContain('flex-row');
    expect(screen.getByText('Simple play dashboard')).toBeTruthy();
  });

  it('reverses the shell split when the sidebar is moved to the right and still renders overlays', () => {
    settingsState.sidebarPosition = 'right';
    const props = createProps();
    props.overlays.showSettings = true;
    props.overlays.showMultiplayer = true;

    render(<AppLayout {...props} />);

    expect(screen.getByTestId('app-layout-split').className).toContain('flex-row-reverse');
    expect(screen.getByText('Settings page')).toBeTruthy();
    expect(screen.getByText('Multiplayer page')).toBeTruthy();
  });
});
