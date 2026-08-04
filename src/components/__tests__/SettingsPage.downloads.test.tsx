// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
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
        'settings.downloadsHint': 'Tune mirrors, concurrency, and connection limits for a stable download pipeline.',
        'settings.downloadsTuningTitle': 'Connection tuning',
        'settings.downloadsTuningHint': 'Adjust concurrency only if the automatic defaults do not fit your network or host limits.',
        'settings.download_threads_auto': 'Auto Threads',
        'settings.download_threads_auto_desc': 'Automatically adjust download concurrency.',
        'settings.download_threads': 'Download Threads',
        'settings.max_sockets': 'Max Sockets per Host',
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

vi.mock('../../features/settings/mirrors/MirrorsSettings', () => ({
  MirrorsSettings: ({ embedded }: { embedded?: boolean }) => (
    <div>{embedded ? 'Mirrors embedded' : 'Mirrors standalone'}</div>
  ),
}));

describe('SettingsPage downloads route', () => {
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

  it('renders the real downloads surface without reintroducing a nested downloads hero', async () => {
    render(<SettingsPage onClose={onCloseMock} initialTab="downloads" />);

    expect(screen.getByRole('tabpanel', { name: 'Downloads' })).toBeTruthy();
    expect(await screen.findByText('Mirrors embedded')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Downloads' })).toBeNull();
    expect(screen.getByRole('switch', { name: 'Auto Threads' })).toBeTruthy();
    expect(screen.getByDisplayValue('8')).toBeTruthy();
    expect(screen.getByDisplayValue('16')).toBeTruthy();
  });
});
