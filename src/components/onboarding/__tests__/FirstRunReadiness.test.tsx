// @vitest-environment jsdom

import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FirstRunReadiness } from '../FirstRunReadiness';

const mocks = vi.hoisted(() => ({
  check: vi.fn(),
}));

vi.mock('../../../contexts/SettingsContext', () => ({
  useSettings: () => ({ t: (key: string) => key }),
}));

vi.mock('../../../services/ipc/systemReadinessIPC', () => ({
  systemReadinessIPC: { isAvailable: () => true, check: mocks.check },
}));

describe('FirstRunReadiness', () => {
  beforeEach(() => {
    mocks.check.mockReset();
  });

  it('shows only bounded readiness outcomes returned by main', async () => {
    mocks.check.mockResolvedValue({
      overall: 'attention',
      checks: [
        { id: 'storage', status: 'ready', code: 'ready' },
        { id: 'disk', status: 'warning', code: 'low-space' },
        { id: 'java', status: 'info', code: 'automatic-download' },
        { id: 'network', status: 'warning', code: 'unreachable' },
      ],
    });

    render(<FirstRunReadiness />);

    await waitFor(() => expect(screen.getByTestId('first-run-readiness')).toBeTruthy());
    expect(screen.getByText('onboarding.readiness.attention')).toBeTruthy();
    expect(screen.getByText('onboarding.readiness.storage.ready')).toBeTruthy();
    expect(screen.getByText('onboarding.readiness.disk.low-space')).toBeTruthy();
    expect(document.body.textContent).not.toContain('/Users/');
  });
});
