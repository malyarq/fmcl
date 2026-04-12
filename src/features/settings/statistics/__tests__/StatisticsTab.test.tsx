// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StatisticsTab } from '../StatisticsTab';

const getStatsMock = vi.fn();
const exportStatsMock = vi.fn();
const showSaveDialogMock = vi.fn();
const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();

vi.mock('../../../../contexts/SettingsContext', () => ({
  useSettings: () => ({
    t: (key: string) => key,
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
      filePath: '/tmp/fmcl-statistics.json',
    });
    exportStatsMock.mockResolvedValue({
      filePath: '/tmp/fmcl-statistics.json',
      exportedAt: '2026-04-12T08:15:00.000Z',
    });
  });

  it('renders popular modpacks and usage trends from the typed statistics IPC seam', async () => {
    render(<StatisticsTab />);

    await screen.findByText('stats.popular_modpacks');
    await screen.findByText('Alpha Pack');
    await screen.findByText('stats.usage_trend');
    expect(screen.getByRole('list', { name: 'stats.popular_modpacks' })).toBeTruthy();
    expect(screen.getByRole('list', { name: 'stats.usage_trend' })).toBeTruthy();
    expect(screen.getByRole('list', { name: 'stats.instance_stats' })).toBeTruthy();

    expect(getStatsMock).toHaveBeenCalledOnce();
  });

  it('exports statistics through the save dialog and typed IPC wrapper', async () => {
    render(<StatisticsTab />);

    const exportButton = await screen.findByRole('button', { name: 'stats.export' });
    fireEvent.click(exportButton);

    await waitFor(() => {
      expect(showSaveDialogMock).toHaveBeenCalledOnce();
    });

    await waitFor(() => {
      expect(exportStatsMock).toHaveBeenCalledWith('/tmp/fmcl-statistics.json');
    });

    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledWith('stats.exportSuccess');
    });
  });
});
