// @vitest-environment jsdom

import { render, screen, waitFor } from '@testing-library/react';
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
        'settings.storage.title': 'Storage',
        'settings.storage.description': 'Track deduplicated content usage and clean up stored files that are no longer needed.',
        'settings.storage.cleanup': 'Cleanup',
        'settings.storage.cleanupDesc': 'Remove unreferenced stored files.',
        'settings.storage.cleanupBtn': 'Run cleanup',
        'settings.storage.totalSize': 'Total size',
        'settings.storage.savedSize': 'Saved size',
        'settings.storage.storedFiles': 'Stored files',
        'settings.storage.totalLogicalFiles': 'Logical files',
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

vi.mock('../../features/accounts/AccountsPage', () => ({
  AccountsPage: () => <div>Accounts tab</div>,
}));

vi.mock('../../features/settings/statistics/StatisticsTab', () => ({
  StatisticsTab: () => <div>Statistics tab</div>,
}));

vi.mock('../UpdateModal', () => ({
  UpdateModal: () => null,
}));

vi.mock('../../contexts/ConfirmContext', () => ({
  useConfirm: () => ({
    confirm: vi.fn(),
  }),
}));

vi.mock('../../services/ipc/storageMaintenanceIPC', () => ({
  storageMaintenanceIPC: {
    getStats: (...args: unknown[]) => getStatsMock(...args),
    cleanup: vi.fn(),
  },
}));

describe('SettingsPage storage route', () => {
  beforeEach(() => {
    getStatsMock.mockReset();
    getStatsMock.mockResolvedValue({
      totalSize: 1024 * 1024,
      dedupedSize: 512 * 1024,
      totalFiles: 42,
      storedFiles: 21,
    });

    window.matchMedia = vi.fn().mockImplementation(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
    })) as typeof window.matchMedia;
  });

  it('renders storage cleanup and metrics inside the shared settings shell without a nested storage hero', async () => {
    render(<SettingsPage onClose={vi.fn()} initialTab="storage" />);

    expect(screen.getByRole('tabpanel', { name: 'Storage' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Storage' })).toBeNull();

    await waitFor(() => {
      expect(getStatsMock).toHaveBeenCalledOnce();
    });

    expect(await screen.findByText('Cleanup')).toBeTruthy();
    expect(screen.queryByText('Track deduplicated content usage and clean up stored files that are no longer needed.')).toBeNull();
    expect(screen.getByText('Cleanup').closest('.surface-muted')).toBeTruthy();
    expect(screen.getByText('Total size').closest('.surface-muted')).toBeTruthy();
    expect(screen.getByText('Total size')).toBeTruthy();
    expect(screen.getByText('Saved size')).toBeTruthy();
    expect(screen.getByText('Stored files')).toBeTruthy();
    expect(screen.getByText('Logical files')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Storage' })).toBeNull();
  });
});
