// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SettingsPage from '../SettingsPage';

const onCloseMock = vi.fn();

vi.mock('../../contexts/SettingsContext', () => ({
  useSettings: () => ({
    hideLauncher: true,
    setHideLauncher: vi.fn(),
    showConsole: false,
    setShowConsole: vi.fn(),
    t: (key: string) =>
      ({
        'settings.title': 'Launcher Settings',
        'settings.done': 'Done',
        'settings.tab_appearance': 'Appearance',
        'settings.tab_downloads': 'Downloads',
        'settings.tab_launcher': 'Launcher',
        'settings.tab_storage': 'Storage',
        'settings.tab_accounts': 'Accounts',
        'settings.tab_statistics': 'Statistics',
        'settings.launcherHint': 'Manage runtime behavior, update checks, and persistent launcher caches from one place.',
        'settings.performance': 'Hide launcher while playing',
        'settings.performance_desc': 'Hide launcher window while playing to save resources.',
        'settings.console': 'Developer console',
        'settings.console_desc': 'Keep the developer console available while diagnosing launcher issues.',
        'settings.ui_zoom': 'Interface Zoom',
        'settings.animations': 'Enable Animations',
        'settings.animations_scope_desc': 'Controls launcher motion and background effects without changing preset colors or surfaces.',
        'settings.compact_mode': 'Compact Mode',
        'settings.compact_mode_desc': 'Tightens launcher spacing and list density; it does not change the active preset.',
        'settings.sidebar_position': 'Sidebar Position',
        'settings.sidebar_position_left': 'Left',
        'settings.sidebar_position_right': 'Right',
        'settings.sidebar_position_desc': 'Moves launcher navigation only; preset visuals stay unchanged.',
        'settings.launcher_runtime_title': 'Launcher Runtime',
        'settings.launcher_runtime_desc': 'Tune how the launcher behaves while you play, debug issues, and navigate the shell.',
        'settings.updatesTitle': 'Updates',
        'settings.updatesDesc': 'Check for launcher updates on demand.',
        'settings.reset': 'Reset',
      }[key] ?? key),
    minecraftPath: '/minecraft',
    setMinecraftPath: vi.fn(),
    autoDownloadThreads: true,
    setAutoDownloadThreads: vi.fn(),
    downloadThreads: 8,
    setDownloadThreads: vi.fn(),
    maxSockets: 16,
    setMaxSockets: vi.fn(),
    uiScale: 110,
    setUiScale: vi.fn(),
    disableAnimations: false,
    setDisableAnimations: vi.fn(),
    sidebarPosition: 'left',
    setSidebarPosition: vi.fn(),
    compactMode: true,
    setCompactMode: vi.fn(),
    getAccentStyles: () => ({ className: '', style: undefined }),
  }),
}));

vi.mock('../../features/updater/hooks/useAppUpdater', () => ({
  useAppUpdater: () => ({
    status: 'idle',
    updateInfo: null,
    progress: 0,
    checkForUpdates: vi.fn(),
    installUpdate: vi.fn(),
  }),
}));

vi.mock('../settings/tabs/AppearanceTab', () => ({
  AppearanceTab: () => <div>Appearance tab</div>,
}));

vi.mock('../settings/tabs/DownloadsTab', () => ({
  DownloadsTab: () => <div>Downloads tab</div>,
}));

vi.mock('../settings/tabs/StorageTab', () => ({
  StorageSettings: () => <div>Storage tab</div>,
}));

vi.mock('../../features/accounts/AccountsPage', () => ({
  AccountsPage: () => <div>Accounts tab</div>,
}));

vi.mock('../../features/settings/statistics/StatisticsTab', () => ({
  StatisticsTab: () => <div>Statistics tab</div>,
}));

vi.mock('../UpdateModal', () => ({
  UpdateModal: () => null,
}));

vi.mock('../../services/ipc/modpacksIPC', () => ({
  modpacksIPC: {},
}));

vi.mock('../../contexts/ToastContext', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('../../contexts/ConfirmContext', () => ({
  useConfirm: () => ({
    confirm: vi.fn(),
  }),
}));

vi.mock('../../services/ipc/cacheIPC', () => ({
  cacheIPC: {
    has: () => false,
    clear: vi.fn(),
    reload: vi.fn(),
  },
}));

vi.mock('../settings/tabs/game/MinecraftPathSection', () => ({
  MinecraftPathSection: () => <div>Minecraft path surface</div>,
}));

describe('SettingsPage launcher route', () => {
  beforeEach(() => {
    onCloseMock.mockReset();
    window.matchMedia = vi.fn().mockImplementation(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
    })) as typeof window.matchMedia;
  });

  it('surfaces runtime, layout, and motion controls from Launcher instead of Appearance', async () => {
    render(<SettingsPage onClose={onCloseMock} initialTab="launcher" />);

    expect(screen.getByRole('tabpanel', { name: 'Launcher' })).toBeTruthy();
    expect(screen.getByText('Launcher Runtime')).toBeTruthy();
    expect(screen.getByRole('switch', { name: 'Hide launcher while playing' })).toBeTruthy();
    expect(screen.getByRole('switch', { name: 'Developer console' })).toBeTruthy();
    expect(screen.getByRole('switch', { name: 'Enable Animations' })).toBeTruthy();
    expect(screen.getByRole('switch', { name: 'Compact Mode' })).toBeTruthy();
    expect(screen.getByText('Sidebar Position')).toBeTruthy();
    expect(screen.getByDisplayValue('110')).toBeTruthy();
    expect(screen.getByText('Minecraft path surface')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Launcher' })).toBeNull();
  });
});
