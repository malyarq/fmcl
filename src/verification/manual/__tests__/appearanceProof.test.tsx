// @vitest-environment jsdom

import { act, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installManualVerificationEnvironment } from '../mockEnvironment';
import { ManualVerificationScenarios } from '../scenarios';

let renderBehaviorReady = true;

vi.mock('../../../components/TitleBar', () => ({
  default: () => <div>FriendLauncher</div>,
}));

vi.mock('../../../components/Sidebar', () => ({
  default: () => <div>Sidebar</div>,
}));

vi.mock('../../../components/SettingsPage', () => ({
  default: ({ initialTab }: { initialTab?: string }) => (
    <div>
      <div data-testid="settings-shell-header">
        <div role="tablist" aria-label="Launcher Settings">
          <button type="button">Appearance</button>
        </div>
      </div>
      {initialTab === 'appearance' && (
        <>
          {renderBehaviorReady ? (
            <>
              <div id="settings-panel-appearance" role="tabpanel">
                <div>Visible Background Scope</div>
              </div>
              <label>
                Theme Presets
                <select aria-label="Theme Presets">
                  <option>Forest</option>
                </select>
              </label>
              <div data-testid="appearance-background-scope">
                Background controls repaint the shell frame and backdrop around this modal while the settings panels stay readable on top.
              </div>
              <button type="button" className="settings-accent-chip">
                Accent
              </button>
            </>
          ) : (
            <>
              <div>Theme Presets</div>
              <div>Visible Background Scope</div>
              <div>Apply a ready-made shell and surface profile, or import/export your own configuration.</div>
            </>
          )}
        </>
      )}
      {initialTab === 'accounts' && <div>Accounts</div>}
    </div>
  ),
}));

describe('manual appearance proof', () => {
  beforeEach(() => {
    installManualVerificationEnvironment();
  });

  afterEach(() => {
    renderBehaviorReady = true;
    vi.useRealTimers();
  });

  it('marks the appearance scenario ready only after the observable settings proof checks pass', async () => {
    const onReady = vi.fn();

    render(<ManualVerificationScenarios view="settings-appearance" onReady={onReady} />);

    await waitFor(() => {
      expect(onReady).toHaveBeenCalledWith(
        'Phase 36 settings proof rendered above the real shell with observable checks for duplicate-copy removal, preset predictability, aligned control geometry, and visible-effect scope.',
      );
    });
  });

  it('does not mark the appearance scenario ready from text-only copy when observable checks are missing', async () => {
    vi.useFakeTimers();
    renderBehaviorReady = false;
    const onReady = vi.fn();

    render(<ManualVerificationScenarios view="settings-appearance" onReady={onReady} />);

    await act(async () => {
      vi.advanceTimersByTime(4_100);
    });

    expect(onReady).not.toHaveBeenCalled();
  });
});
