// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider, useSettings } from '../../SettingsContext';

const { openConsoleMock, closeConsoleMock } = vi.hoisted(() => ({
  openConsoleMock: vi.fn(),
  closeConsoleMock: vi.fn(),
}));

vi.mock('../../../services/ipc/windowControlsIPC', () => ({
  windowControlsIPC: {
    openConsole: () => openConsoleMock(),
    closeConsole: () => closeConsoleMock(),
  },
}));

describe('console visibility', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.history.replaceState({}, '', '/');
    openConsoleMock.mockReset();
    closeConsoleMock.mockReset();
  });

  it('starts closed even when an older version persisted an open console', async () => {
    window.localStorage.setItem('settings_showConsole', 'true');

    render(
      <SettingsProvider>
        <ConsoleToggle />
      </SettingsProvider>,
    );

    expect(screen.getByRole('button', { name: 'Open console' })).toBeTruthy();
    await waitFor(() => expect(closeConsoleMock).toHaveBeenCalledTimes(1));
    expect(openConsoleMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Open console' }));
    await waitFor(() => expect(openConsoleMock).toHaveBeenCalledTimes(1));
  });

  it('does not let the console renderer close its own window while booting', async () => {
    window.history.replaceState({}, '', '/#console');

    render(
      <SettingsProvider>
        <div>Console renderer</div>
      </SettingsProvider>,
    );

    expect(await screen.findByText('Console renderer')).toBeTruthy();
    expect(openConsoleMock).not.toHaveBeenCalled();
    expect(closeConsoleMock).not.toHaveBeenCalled();
  });
});

function ConsoleToggle() {
  const { showConsole, setShowConsole } = useSettings();
  return (
    <button onClick={() => setShowConsole(!showConsole)}>
      {showConsole ? 'Close console' : 'Open console'}
    </button>
  );
}
