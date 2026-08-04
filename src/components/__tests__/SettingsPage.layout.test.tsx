// @vitest-environment jsdom

import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SettingsPage from '../SettingsPage';

const onCloseMock = vi.fn();

vi.mock('../../contexts/SettingsContext', () => ({
  useSettings: () => ({
    hideLauncher: false,
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
      }[key] ?? key),
    minecraftPath: '/minecraft',
    setMinecraftPath: vi.fn(),
    autoDownloadThreads: true,
    setAutoDownloadThreads: vi.fn(),
    downloadThreads: 8,
    setDownloadThreads: vi.fn(),
    maxSockets: 16,
    setMaxSockets: vi.fn(),
    uiScale: 100,
    setUiScale: vi.fn(),
    disableAnimations: false,
    setDisableAnimations: vi.fn(),
    sidebarPosition: 'left',
    setSidebarPosition: vi.fn(),
    compactMode: false,
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

vi.mock('../settings/tabs/LauncherTab', () => ({
  LauncherTab: () => <div>Launcher tab</div>,
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

vi.mock('../../services/ipc/storageMaintenanceIPC', () => ({
  storageMaintenanceIPC: {},
}));

describe('SettingsPage layout', () => {
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

  it('keeps the settings shell focused on tabs and close actions before the active panel', () => {
    render(<SettingsPage onClose={onCloseMock} initialTab="downloads" />);

    const header = screen.getByTestId('settings-shell-header');
    const panel = screen.getByRole('tabpanel', { name: 'Downloads' });
    const tablist = within(header).getByRole('tablist', { name: 'Launcher Settings' });
    const downloadsTab = within(tablist).getByRole('tab', { name: 'Downloads' });

    expect(within(header).getByRole('button', { name: 'Done' })).toBeTruthy();
    expect(Array.from(header.parentElement?.children ?? [])).toEqual([header, panel]);
    expect(panel.previousElementSibling).toBe(header);
    expect(within(downloadsTab).getByText('Downloads')).toBeTruthy();
    expect(screen.queryByText('Tune mirrors, concurrency, and connection limits for a stable download pipeline.')).toBeNull();
  });
});
