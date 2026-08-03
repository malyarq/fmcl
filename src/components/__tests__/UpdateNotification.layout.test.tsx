// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTranslator } from '../../contexts/settings/i18n';
import {
  APP_LAYOUT_NOTIFICATIONS_TEST_ID,
  APP_LAYOUT_SAFE_AREA_TEST_ID,
  AppLayout,
  type AppLayoutProps,
} from '../AppLayout';
import { APP_ICON_PATH } from '../../app/assets/branding';

const t = createTranslator('en');
const uiModeState = { value: 'simple' as 'simple' | 'modpacks' };
const settingsState = { sidebarPosition: 'left' as 'left' | 'right' };
const titleBarState = { platform: 'default' as 'default' | 'macos' };
const shellContractState = { value: 'renderer-controls' as 'renderer-controls' | 'native-macos' };

vi.mock('../../contexts/SettingsContext', () => ({
  useUIMode: () => ({
    uiMode: uiModeState.value,
  }),
  useSettings: () => ({
    sidebarPosition: settingsState.sidebarPosition,
    t,
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
  default: () => (
    <div data-testid="app-title-bar" data-platform={titleBarState.platform}>
      Title bar
    </div>
  ),
}));

vi.mock('../Sidebar', () => ({
  default: () => <aside>Sidebar</aside>,
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
      status: 'available',
      info: { version: '0.5.1' },
      onInstall: vi.fn(),
      onDownload: vi.fn(),
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

describe('UpdateNotification shell layout', () => {
  beforeEach(() => {
    uiModeState.value = 'simple';
    settingsState.sidebarPosition = 'left';
    titleBarState.platform = 'default';
    shellContractState.value = 'renderer-controls';
  });

  it('renders the app update banner directly below the shared title-bar seam', () => {
    const props = createProps();
    render(<AppLayout {...props} />);

    const titleBar = screen.getByTestId('app-title-bar');
    const notifications = screen.getByTestId(APP_LAYOUT_NOTIFICATIONS_TEST_ID);
    const safeArea = screen.getByTestId(APP_LAYOUT_SAFE_AREA_TEST_ID);
    const banner = screen.getByTestId('app-update-notification');

    expect(titleBar.nextElementSibling).toBe(notifications);
    expect(notifications.nextElementSibling).toBe(safeArea);
    expect(safeArea.getAttribute('data-shell-safe-area')).toBe('shell-chrome');
    expect(notifications.getAttribute('data-shell-platform')).toBe('renderer-controls');
    expect(safeArea.getAttribute('data-shell-platform')).toBe('renderer-controls');
    expect(safeArea.className).toContain('pt-2');
    expect(banner.getAttribute('data-update-scope')).toBe('app-shell');
    expect(banner.className).toContain('relative');
    expect(banner.className).not.toContain('fixed');
    expect(banner.textContent).toContain('Launcher update available');
    fireEvent.click(screen.getByRole('button', { name: 'Download update' }));
    expect(props.updates.onDownload).toHaveBeenCalledOnce();
    expect(banner.textContent).not.toContain('Review update');
  });

  it('keeps the macOS update banner inline under the native-first shell seam', () => {
    titleBarState.platform = 'macos';
    shellContractState.value = 'native-macos';

    render(<AppLayout {...createProps()} />);

    const titleBar = screen.getByTestId('app-title-bar');
    const notifications = screen.getByTestId(APP_LAYOUT_NOTIFICATIONS_TEST_ID);
    const safeArea = screen.getByTestId(APP_LAYOUT_SAFE_AREA_TEST_ID);
    const banner = screen.getByTestId('app-update-notification');

    expect(titleBar.getAttribute('data-platform')).toBe('macos');
    expect(titleBar.nextElementSibling).toBe(notifications);
    expect(notifications.getAttribute('data-shell-platform')).toBe('native-macos');
    expect(safeArea.getAttribute('data-shell-platform')).toBe('native-macos');
    expect(safeArea.className).toContain('pt-1');
    expect(banner.getAttribute('data-update-scope')).toBe('app-shell');
    expect(banner.className).toContain('relative');
    expect(banner.className).not.toContain('fixed');
    expect(banner.textContent).toContain('Launcher update available');
    expect(banner.textContent).not.toContain('Review update');
  });
});
