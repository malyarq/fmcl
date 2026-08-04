// @vitest-environment jsdom

import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SettingsPage from '../../SettingsPage';

const onCloseMock = vi.fn();

vi.mock('../../../contexts/SettingsContext', () => ({
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
    downloadThreads: 6,
    setDownloadThreads: vi.fn(),
    maxSockets: 24,
    setMaxSockets: vi.fn(),
    getAccentStyles: () => ({ className: '', style: undefined }),
  }),
}));

vi.mock('../../../features/updater/hooks/useAppUpdater', () => ({
  useAppUpdater: () => ({
    status: 'idle',
    updateInfo: null,
    progress: 0,
    checkForUpdates: vi.fn(),
    installUpdate: vi.fn(),
  }),
}));

vi.mock('../tabs/AppearanceTab', () => ({
  AppearanceTab: () => <div>Appearance surface</div>,
}));

vi.mock('../tabs/DownloadsTab', () => ({
  DownloadsTab: () => <div>Downloads utility surface</div>,
}));

vi.mock('../tabs/LauncherTab', () => ({
  LauncherTab: () => <div>Launcher utility surface</div>,
}));

vi.mock('../tabs/StorageTab', () => ({
  StorageSettings: () => <div>Storage utility surface</div>,
}));

vi.mock('../../../features/accounts/AccountsPage', () => ({
  AccountsPage: () => <div>Accounts utility surface</div>,
}));

vi.mock('../../../features/settings/statistics/StatisticsTab', () => ({
  StatisticsTab: () => <div>Statistics utility surface</div>,
}));

vi.mock('../../UpdateModal', () => ({
  UpdateModal: () => null,
}));

vi.mock('../../../services/ipc/storageMaintenanceIPC', () => ({
  storageMaintenanceIPC: {},
}));

function mockMatchMedia(matches = false) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

describe('SettingsPage secondary utility routes', () => {
  beforeEach(() => {
    mockMatchMedia(false);
    onCloseMock.mockReset();
  });

  it('switches between lower-traffic settings utilities without restoring route-level helper copy', () => {
    render(<SettingsPage onClose={onCloseMock} />);
    const header = screen.getByTestId('settings-shell-header');

    fireEvent.click(screen.getByRole('tab', { name: 'Downloads' }));
    expect(screen.getByRole('tab', { name: 'Downloads' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tabpanel', { name: 'Downloads' })).toBeTruthy();
    expect(screen.getByText('Downloads utility surface')).toBeTruthy();
    expect(within(header).queryByText('Tune mirrors, concurrency, and connection limits for a stable download pipeline.')).toBeNull();

    fireEvent.click(screen.getByRole('tab', { name: 'Launcher' }));
    expect(screen.getByRole('tabpanel', { name: 'Launcher' })).toBeTruthy();
    expect(screen.getByText('Launcher utility surface')).toBeTruthy();
    expect(within(header).queryByText('Manage runtime behavior, update checks, and persistent launcher caches from one place.')).toBeNull();

    fireEvent.click(screen.getByRole('tab', { name: 'Storage' }));
    expect(screen.getByRole('tabpanel', { name: 'Storage' })).toBeTruthy();
    expect(screen.getByText('Storage utility surface')).toBeTruthy();
    expect(within(header).queryByText('Track deduplicated content usage and clean up stored files that are no longer needed.')).toBeNull();

    fireEvent.click(screen.getByRole('tab', { name: 'Statistics' }));
    expect(screen.getByRole('tabpanel', { name: 'Statistics' })).toBeTruthy();
    expect(screen.getByText('Statistics utility surface')).toBeTruthy();
    expect(within(header).queryByText('Review launches, play time, and local usage trends before exporting the current snapshot.')).toBeNull();
  });
});
