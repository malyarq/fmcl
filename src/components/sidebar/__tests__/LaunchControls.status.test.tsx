// @vitest-environment jsdom

import type { ComponentProps } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTranslator } from '../../../contexts/settings/i18n';
import { LaunchControls } from '../LaunchControls';

const killAndRestartMock = vi.fn();
const hasMock = vi.fn<(key: string) => boolean>();

vi.mock('../../../services/ipc/launcherIPC', () => ({
  launcherIPC: {
    has: (key: string) => hasMock(key),
    killAndRestart: () => killAndRestartMock(),
  },
}));

function renderLaunchControls(overrides: Partial<ComponentProps<typeof LaunchControls>> = {}) {
  return render(
    <LaunchControls
      isLaunching={false}
      progress={0}
      launchStage="idle"
      statusText=""
      statusDetail=""
      canForceRestart={false}
      onLaunch={vi.fn()}
      t={createTranslator('en')}
      getAccentHex={() => '#10b981'}
      getAccentStyles={() => ({ className: '', style: undefined })}
      {...overrides}
    />,
  );
}

describe('LaunchControls launch-state seam', () => {
  beforeEach(() => {
    killAndRestartMock.mockReset();
    hasMock.mockReset();
    hasMock.mockReturnValue(true);
  });

  it('shows stage-aware downloading copy without exposing restart too early', () => {
    renderLaunchControls({
      isLaunching: true,
      progress: 42,
      launchStage: 'downloading',
      statusText: 'Downloading',
      statusDetail: 'Game assets - 42%',
    });

    expect(screen.getAllByText('Downloading')).toHaveLength(2);
    expect(screen.getByText('Game assets - 42%')).toBeTruthy();

    const launchButton = screen.getByRole('button', { name: /^Downloading$/i });
    expect(launchButton).toHaveProperty('disabled', true);
    expect(screen.queryByRole('button', { name: /Force restart/i })).toBeNull();
  });

  it('shows force restart only for waiting or running states', () => {
    renderLaunchControls({
      isLaunching: true,
      launchStage: 'waiting',
      statusText: 'Waiting for Minecraft',
      statusDetail: 'Minecraft process started. Waiting for the game window and logs.',
      canForceRestart: true,
    });

    fireEvent.click(screen.getByRole('button', { name: /Force restart/i }));
    expect(killAndRestartMock).toHaveBeenCalledTimes(1);
  });

  it('keeps failure feedback visible while returning the main action to Play', () => {
    renderLaunchControls({
      isLaunching: false,
      launchStage: 'failed',
      statusText: 'Launch failed',
      statusDetail: 'Minecraft closed with exit code 1',
    });

    expect(screen.getByText('Launch failed')).toBeTruthy();
    expect(screen.getByText('Minecraft closed with exit code 1')).toBeTruthy();

    const launchButton = screen.getByRole('button', { name: /^Play$/i });
    expect(launchButton).toHaveProperty('disabled', false);
  });
});
