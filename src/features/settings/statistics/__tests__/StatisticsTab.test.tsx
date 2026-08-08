// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StatisticsTab } from '../StatisticsTab';

const getStatsMock = vi.fn();
const exportStatsMock = vi.fn();
const showSaveDialogMock = vi.fn();
const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();
const formatDateMock = vi.fn((
  timestamp: number | undefined,
  unknownText = 'Unknown',
  _options?: Intl.DateTimeFormatOptions,
) => (timestamp ? `date:${timestamp}` : unknownText));
const formatNumberMock = vi.fn((value: number, _options?: Intl.NumberFormatOptions) => `n:${value}`);

vi.mock('../../../../contexts/SettingsContext', () => ({
  useSettings: () => ({
    t: (key: string) => key,
    formatDate: (...args: Parameters<typeof formatDateMock>) => formatDateMock(...args),
    formatNumber: (...args: Parameters<typeof formatNumberMock>) => formatNumberMock(...args),
    getAccentHex: () => '#10b981',
  }),
}));

vi.mock('../../../../contexts/ToastContext', () => ({
  useToast: () => ({
    success: (...args: unknown[]) => toastSuccessMock(...args),
    error: (...args: unknown[]) => toastErrorMock(...args),
  }),
}));

vi.mock('../../../../services/ipc/statisticsIPC', () => ({
  statisticsIPC: {
    getStats: (...args: unknown[]) => getStatsMock(...args),
    exportStats: (...args: unknown[]) => exportStatsMock(...args),
  },
}));

vi.mock('../../../../services/ipc/dialogIPC', () => ({
  dialogIPC: {
    showSaveDialog: (...args: unknown[]) => showSaveDialogMock(...args),
  },
}));

describe('StatisticsTab', () => {
  beforeEach(() => {
    getStatsMock.mockReset();
    exportStatsMock.mockReset();
    showSaveDialogMock.mockReset();
    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();
    formatDateMock.mockClear();
    formatNumberMock.mockClear();

    getStatsMock.mockResolvedValue({
      global: {
        totalPlayTime: 60 * 60 * 1000,
        totalLaunches: 4,
        lastPlayed: 1_775_000_000_000,
      },
      instances: {
        alpha: {
          name: 'Alpha Pack',
          playTime: 45 * 60 * 1000,
          launches: 3,
          lastPlayed: 1_775_000_000_000,
        },
      },
      history: {
        '2026-04-10': { launches: 1, playTime: 15 * 60 * 1000 },
        '2026-04-11': { launches: 3, playTime: 45 * 60 * 1000 },
      },
      popularModpacks: [
        {
          instanceId: 'alpha',
          name: 'Alpha Pack',
          playTime: 45 * 60 * 1000,
          launches: 3,
          lastPlayed: 1_775_000_000_000,
        },
      ],
      usageTrend: [
        { date: '2026-04-10', launches: 1, playTime: 15 * 60 * 1000 },
        { date: '2026-04-11', launches: 3, playTime: 45 * 60 * 1000 },
      ],
    });
    showSaveDialogMock.mockResolvedValue({
      canceled: false,
      filePath: '/tmp/burrow-statistics.json',
    });
    exportStatsMock.mockResolvedValue({
      filePath: '/tmp/burrow-statistics.json',
      exportedAt: '2026-04-12T08:15:00.000Z',
    });
  });

  it('renders popular modpacks and usage trends from the typed statistics IPC seam', async () => {
    render(<StatisticsTab />);

    expect((await screen.findAllByText('stats.description')).length).toBeGreaterThan(0);
    await screen.findByRole('heading', { name: 'stats.popular_modpacks' });
    const summaryShell = screen.getByRole('button', { name: 'stats.export' }).closest('.settings-section-shell, .surface-muted');
    expect(summaryShell?.contains(screen.getByText('stats.total_play_time'))).toBe(true);
    expect((await screen.findAllByText('Alpha Pack')).length).toBeGreaterThan(0);
    await screen.findByRole('heading', { name: 'stats.usage_trend' });
    expect(screen.getByRole('list', { name: 'stats.popular_modpacks' })).toBeTruthy();
    expect(screen.getByRole('list', { name: 'stats.usage_trend' })).toBeTruthy();
    expect(screen.getByRole('list', { name: 'stats.instance_stats' })).toBeTruthy();
    expect(screen.getByText('n:1h n:0m n:0s')).toBeTruthy();
    expect(screen.getByText('stats.last_played: date:1775000000000')).toBeTruthy();
    expect(screen.getAllByText('stats.launches: n:3').length).toBeGreaterThan(0);

    expect(getStatsMock).toHaveBeenCalledOnce();
    expect(formatDateMock).toHaveBeenCalledWith(1_775_000_000_000, '—', { dateStyle: 'medium' });
  });

  it('exports statistics through the save dialog and typed IPC wrapper', async () => {
    render(<StatisticsTab />);

    const exportButton = await screen.findByRole('button', { name: 'stats.export' });
    fireEvent.click(exportButton);

    await waitFor(() => {
      expect(showSaveDialogMock).toHaveBeenCalledOnce();
    });

    await waitFor(() => {
      expect(exportStatsMock).toHaveBeenCalledWith('/tmp/burrow-statistics.json');
    });

    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledWith('stats.exportSuccess');
    });
  });

  it('shows a degraded error state instead of staying on the loading spinner when stats fail', async () => {
    getStatsMock
      .mockRejectedValueOnce(new Error('[IPC] getStats failed: Statistics store unavailable'))
      .mockResolvedValueOnce({
        global: {
          totalPlayTime: 60 * 60 * 1000,
          totalLaunches: 4,
          lastPlayed: 1_775_000_000_000,
        },
        instances: {
          alpha: {
            name: 'Alpha Pack',
            playTime: 45 * 60 * 1000,
            launches: 3,
            lastPlayed: 1_775_000_000_000,
          },
        },
        history: {
          '2026-04-10': { launches: 1, playTime: 15 * 60 * 1000 },
          '2026-04-11': { launches: 3, playTime: 45 * 60 * 1000 },
        },
        popularModpacks: [
          {
            instanceId: 'alpha',
            name: 'Alpha Pack',
            playTime: 45 * 60 * 1000,
            launches: 3,
            lastPlayed: 1_775_000_000_000,
          },
        ],
        usageTrend: [
          { date: '2026-04-10', launches: 1, playTime: 15 * 60 * 1000 },
          { date: '2026-04-11', launches: 3, playTime: 45 * 60 * 1000 },
        ],
      });

    render(<StatisticsTab />);

    const errorState = await screen.findByRole('alert');
    expect(screen.getByRole('heading', { name: 'error.inline_fallback' })).toBeTruthy();
    expect(errorState.textContent).toContain('degraded.error_label');
    expect(errorState.textContent).not.toContain('stats.loading');

    fireEvent.click(screen.getByRole('button', { name: 'modpacks.world_refresh' }));

    await screen.findByRole('heading', { name: 'stats.popular_modpacks' });
  });
});
