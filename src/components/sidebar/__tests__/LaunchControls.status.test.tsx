// @vitest-environment jsdom

import type { ComponentProps } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTranslator } from '../../../contexts/settings/i18n';
import { getProgressStatus } from '../../../features/launcher/services/launcherService';
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
    const t = createTranslator('ru');
    const progressStatus = getProgressStatus({ type: 'assets', task: 42, total: 100 }, t);

    renderLaunchControls({
      isLaunching: true,
      progress: 42,
      launchStage: progressStatus.stage,
      statusText: progressStatus.title,
      statusDetail: progressStatus.detail,
      t,
    });

    expect(screen.getAllByText('Загрузка')).toHaveLength(2);
    expect(screen.getByText('Игровые ассеты - 42%')).toBeTruthy();

    const launchButton = screen.getByRole('button', { name: /^Загрузка$/i });
    expect(launchButton).toHaveProperty('disabled', true);
    expect(screen.queryByRole('button', { name: /Force restart/i })).toBeNull();
  });

  it('localizes launch-adjacent controls from the active launcher language', () => {
    renderLaunchControls({
      isLaunching: true,
      launchStage: 'waiting',
      canForceRestart: true,
      t: createTranslator('ru'),
    });

    expect(screen.getByRole('button', { name: 'Ожидание Minecraft' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Перезапустить принудительно' })).toBeTruthy();
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

  it('does not offer a renderer reload when process restart capability is unavailable', () => {
    hasMock.mockReturnValue(false);

    renderLaunchControls({
      isLaunching: true,
      launchStage: 'waiting',
      canForceRestart: true,
    });

    expect(screen.queryByRole('button', { name: /Force restart/i })).toBeNull();
    expect(killAndRestartMock).not.toHaveBeenCalled();
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

  it('preserves launch copy when the shell demotes the button to a secondary context', () => {
    renderLaunchControls({
      priority: 'secondary',
    });

    const launchButton = screen.getByRole('button', { name: /^Play$/i });
    expect(launchButton.getAttribute('data-launch-priority')).toBe('secondary');
    expect(launchButton).toHaveProperty('disabled', false);
  });
});
