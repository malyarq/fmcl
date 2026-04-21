// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SettingsPage from '../SettingsPage';

const getStatsMock = vi.fn();

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
        'stats.description': 'Review launches, play time, and local usage trends before exporting the current snapshot.',
        'stats.global_stats': 'Global Stats',
        'stats.export': 'Export',
        'stats.exporting': 'Exporting',
        'stats.popular_modpacks': 'Popular modpacks',
        'stats.usage_trend': 'Usage trend',
        'stats.instance_stats': 'Instance stats',
        'stats.total_play_time': 'Total play time',
        'stats.total_launches': 'Total launches',
        'stats.average_session': 'Average session',
      }[key] ?? key),
    formatDate: vi.fn((_timestamp?: number) => 'Apr 11'),
    formatNumber: vi.fn((value: number) => String(value)),
    getAccentHex: () => '#10b981',
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

vi.mock('../../services/ipc/dialogIPC', () => ({
  dialogIPC: {
    showSaveDialog: vi.fn(),
  },
}));

vi.mock('../../services/ipc/statisticsIPC', () => ({
  statisticsIPC: {
    getStats: (...args: unknown[]) => getStatsMock(...args),
    exportStats: vi.fn(),
  },
}));

describe('SettingsPage statistics route', () => {
  beforeEach(() => {
    getStatsMock.mockReset();
    getStatsMock.mockResolvedValue({
      global: {
        totalPlayTime: 60 * 60 * 1000,
        totalLaunches: 4,
        lastPlayed: 1_775_000_000_000,
      },
      instances: {},
      history: {},
      popularModpacks: [],
      usageTrend: [],
    });

    window.matchMedia = vi.fn().mockImplementation(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
    })) as typeof window.matchMedia;
  });

  it('renders the embedded statistics surface directly from the settings route', async () => {
    render(<SettingsPage onClose={vi.fn()} initialTab="statistics" />);

    expect(screen.getByRole('tabpanel', { name: 'Statistics' })).toBeTruthy();
    expect(await screen.findByRole('heading', { name: 'Global Stats' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Export' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Statistics' })).toBeNull();
  });
});
