// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DownloadsTab } from '../tabs/DownloadsTab';

vi.mock('../../../features/settings/mirrors/MirrorsSettings', () => ({
  MirrorsSettings: ({ embedded }: { embedded?: boolean }) => (
    <div>{embedded ? 'Mirrors embedded surface' : 'Mirrors standalone surface'}</div>
  ),
}));

describe('DownloadsTab layout', () => {
  it('keeps embedded tuning controls inside the shared settings shell at laptop widths', () => {
    const { container } = render(
      <DownloadsTab
        embedded
        autoDownloadThreads
        setAutoDownloadThreads={vi.fn()}
        downloadThreads={8}
        setDownloadThreads={vi.fn()}
        maxSockets={16}
        setMaxSockets={vi.fn()}
        t={(key) =>
          ({
            'settings.downloads': 'Downloads',
            'settings.downloadsHint': 'Tune mirrors, concurrency, and connection limits for a stable download pipeline.',
            'settings.downloadsTuningTitle': 'Connection tuning',
            'settings.downloadsTuningHint': 'Adjust concurrency only if the automatic defaults do not fit your network or host limits.',
            'settings.download_threads_auto': 'Auto Threads',
            'settings.download_threads_auto_desc': 'Automatically adjust download concurrency.',
            'settings.download_threads': 'Download Threads',
            'settings.max_sockets': 'Max Sockets per Host',
          }[key] ?? key)
        }
      />,
    );

    const root = container.firstElementChild as HTMLElement;
    const autoThreadsToggle = screen.getByRole('switch', { name: 'Auto Threads' });
    const tuningShell = screen.getByTestId('downloads-tuning-section');
    const inputsCard = screen.getByDisplayValue('8').closest('.settings-control-card') as HTMLElement;

    expect(root.className).toContain('xl:grid-cols-[minmax(0,1.15fr)_minmax(19rem,0.85fr)]');
    expect(screen.getByText('Mirrors embedded surface')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Downloads' })).toBeNull();
    expect(tuningShell.className).toContain('min-w-0');
    expect(tuningShell.className).toContain('surface-muted');
    expect(tuningShell.className).not.toContain('settings-section-shell');
    expect(autoThreadsToggle.className).toContain('settings-toggle-switch');
    expect(autoThreadsToggle.closest('.settings-toggle-row')).toBeTruthy();
    expect(inputsCard.className).toContain('settings-control-card');
    expect(screen.getByDisplayValue('16')).toBeTruthy();
  });
});
