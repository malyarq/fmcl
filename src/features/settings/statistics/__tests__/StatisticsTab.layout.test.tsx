// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StatisticsTab } from '../StatisticsTab';

const getStatsMock = vi.fn();

vi.mock('../../../../contexts/SettingsContext', () => ({
  useSettings: () => ({
    t: (key: string) =>
      ({
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
  }),
}));

vi.mock('../../../../contexts/ToastContext', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('../../../../services/ipc/statisticsIPC', () => ({
  statisticsIPC: {
    getStats: (...args: unknown[]) => getStatsMock(...args),
    exportStats: vi.fn(),
  },
}));

vi.mock('../../../../services/ipc/dialogIPC', () => ({
  dialogIPC: {
    showSaveDialog: vi.fn(),
  },
}));

describe('StatisticsTab layout', () => {
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
  });

  it('removes the standalone statistics hero when embedded inside SettingsPage', async () => {
    const { container } = render(<StatisticsTab embedded />);

    expect(screen.queryByRole('heading', { name: 'Statistics' })).toBeNull();
    expect(await screen.findByRole('heading', { name: 'Global Stats' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Export' })).toBeTruthy();
    const summaryShell = screen.getByRole('button', { name: 'Export' }).closest('.surface-muted');
    expect(summaryShell?.contains(screen.getByText('Total play time'))).toBe(true);
    expect(container.querySelectorAll('.settings-section-shell')).toHaveLength(0);
    expect(container.querySelectorAll('.surface-muted').length).toBeGreaterThanOrEqual(3);
    expect(screen.queryByText('Review launches, play time, and local usage trends before exporting the current snapshot.')).toBeNull();
  });
});
