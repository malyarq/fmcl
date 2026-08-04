// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { installManualVerificationEnvironment, seedManualVerificationStorage } from '../mockEnvironment';
import { ManualVerificationScenarios } from '../scenarios';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.clearAllMocks();
});

describe('operation recovery manual proof', () => {
  it('mounts the production inbox with safe inspect and dismiss behavior', async () => {
    window.history.replaceState({}, '', '?view=operation-recovery');
    seedManualVerificationStorage('operation-recovery');
    installManualVerificationEnvironment();
    const onReady = vi.fn();

    render(<ManualVerificationScenarios view="operation-recovery" onReady={onReady} />);

    await waitFor(() => {
      expect(onReady).toHaveBeenCalledWith(
        'Phase 41 startup recovery inbox rendered from production ownership with distinct recovered and manual-attention records and no generic replay action.',
      );
    }, { timeout: 4000 });

    const inbox = screen.getByTestId('operation-recovery-inbox');
    expect(inbox.getAttribute('role')).toBe('region');
    expect(inbox.textContent).toContain('Recovered after restart');
    expect(inbox.textContent).toContain('Needs manual attention');
    expect(inbox.textContent).toContain('Export authorization cannot be replayed');
    expect(screen.queryByRole('button', { name: /retry/i })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Inspect Export' }));
    const details = await screen.findByTestId('operation-recovery-details-manual-export-recovery');
    expect(details.textContent).toContain('previous export destination cannot be reused safely');
    expect(details.textContent).not.toContain('/Users/');

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss Export' }));
    await waitFor(() => {
      expect(screen.queryByTestId('operation-recovery-record-manual-export-recovery')).toBeNull();
    });
    expect(screen.getByTestId('operation-recovery-record-manual-recovered-install')).toBeTruthy();
  });
});
