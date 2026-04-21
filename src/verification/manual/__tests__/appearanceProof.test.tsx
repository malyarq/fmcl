// @vitest-environment jsdom

import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ManualVerificationScenarios } from '../scenarios';

vi.mock('../../../components/TitleBar', () => ({
  default: () => <div>FriendLauncher</div>,
}));

vi.mock('../../../components/Sidebar', () => ({
  default: () => <div>Sidebar</div>,
}));

vi.mock('../../../components/SettingsPage', () => ({
  default: ({ initialTab }: { initialTab?: string }) => (
    <div>
      <div>Launcher Settings</div>
      {initialTab === 'appearance' && (
        <>
          <div>Theme Presets</div>
          <div>Visible Background Scope</div>
        </>
      )}
      {initialTab === 'accounts' && <div>Accounts</div>}
    </div>
  ),
}));

describe('manual appearance proof', () => {
  it('marks the appearance scenario ready from the shipped preset-truth copy instead of stale brand-card text', async () => {
    const onReady = vi.fn();

    render(<ManualVerificationScenarios view="settings-appearance" onReady={onReady} />);

    await waitFor(() => {
      expect(onReady).toHaveBeenCalledWith(
        'Phase 30 appearance proof rendered above the real shell so reviewers can verify preset ancestry, bounded customization, and honest launcher-runtime control boundaries without leaving live composition.',
      );
    });
  });
});
