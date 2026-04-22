// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { APP_ICON_PATH } from '../../app/assets/branding';
import {
  APP_LAYOUT_NOTIFICATIONS_TEST_ID,
  APP_LAYOUT_SAFE_AREA_TEST_ID,
  AppLayout,
  type AppLayoutProps,
} from '../AppLayout';

const uiModeState = { value: 'simple' as 'simple' | 'modpacks' };
const settingsState = { sidebarPosition: 'left' as 'left' | 'right' };
const shellContractState = { value: 'renderer-controls' as 'renderer-controls' | 'native-macos' };

vi.mock('../../contexts/SettingsContext', () => ({
  useUIMode: () => ({
    uiMode: uiModeState.value,
  }),
  useSettings: () => ({
    sidebarPosition: settingsState.sidebarPosition,
  }),
}));

vi.mock('../../services/ipc/windowControlsIPC', () => ({
  windowControlsIPC: {
    shellContract: () => shellContractState.value,
  },
}));

vi.mock('../layout/BackgroundLayer', () => ({
  BackgroundLayer: () => <div>Background layer</div>,
}));

vi.mock('../TitleBar', () => ({
  TITLE_BAR_TEST_ID: 'app-title-bar',
  default: () => <div data-testid="app-title-bar">Title bar</div>,
}));

vi.mock('../Sidebar', () => ({
  default: () => <aside>Sidebar</aside>,
}));

vi.mock('../UpdateNotification', () => ({
  UpdateNotification: () => <div>Update notification</div>,
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
      iconPath: APP_ICON_PATH,
    },
  };
}

describe('AppLayout responsive shell', () => {
  beforeEach(() => {
    uiModeState.value = 'simple';
    settingsState.sidebarPosition = 'left';
    shellContractState.value = 'renderer-controls';
  });

  it('renders a shell-owned safe-area seam directly below the title bar', () => {
    render(<AppLayout {...createProps()} />);

    const shellFrame = screen.getByTestId('app-shell-frame');
    const titleBar = screen.getByTestId('app-title-bar');
    const notifications = screen.getByTestId(APP_LAYOUT_NOTIFICATIONS_TEST_ID);
    const safeArea = screen.getByTestId(APP_LAYOUT_SAFE_AREA_TEST_ID);
    const main = screen.getByTestId('app-layout-main');
    const split = screen.getByTestId('app-layout-split');

    expect(shellFrame.className).toContain('min-w-0');
    expect(shellFrame.className).toContain('sm:rounded-[28px]');
    expect(titleBar.nextElementSibling).toBe(notifications);
    expect(notifications.nextElementSibling).toBe(safeArea);
    expect(notifications.textContent).toContain('Update notification');
    expect(safeArea.getAttribute('data-shell-safe-area')).toBe('shell-chrome');
    expect(notifications.getAttribute('data-shell-platform')).toBe('renderer-controls');
    expect(safeArea.getAttribute('data-shell-platform')).toBe('renderer-controls');
    expect(safeArea.className).toContain('pt-2');
    expect(split.parentElement).toBe(safeArea);
    expect(main.className).toContain('min-w-0');
    expect(split.className).toContain('flex-row');
    expect(screen.getByText('Simple play dashboard')).toBeTruthy();
  });

  it('keeps the same safe-area contract when the route and shell state change', () => {
    settingsState.sidebarPosition = 'right';
    uiModeState.value = 'modpacks';
    shellContractState.value = 'native-macos';
    const props = createProps();
    props.overlays.showSettings = true;
    props.overlays.showMultiplayer = true;

    render(<AppLayout {...props} />);

    const safeArea = screen.getByTestId(APP_LAYOUT_SAFE_AREA_TEST_ID);
    const notifications = screen.getByTestId(APP_LAYOUT_NOTIFICATIONS_TEST_ID);

    expect(safeArea.getAttribute('data-shell-safe-area')).toBe('shell-chrome');
    expect(notifications.getAttribute('data-shell-platform')).toBe('native-macos');
    expect(safeArea.getAttribute('data-shell-platform')).toBe('native-macos');
    expect(safeArea.className).toContain('pt-1');
    expect(notifications.previousElementSibling).toBe(screen.getByTestId('app-title-bar'));
    expect(screen.getByTestId('app-layout-split').className).toContain('flex-row-reverse');
    expect(safeArea.contains(screen.getByText('Settings page'))).toBe(true);
    expect(safeArea.contains(screen.getByText('Multiplayer page'))).toBe(true);
    expect(safeArea.contains(screen.getByText('Modpack router'))).toBe(true);
    expect(screen.getByText('Settings page')).toBeTruthy();
    expect(screen.getByText('Multiplayer page')).toBeTruthy();
  });
});
