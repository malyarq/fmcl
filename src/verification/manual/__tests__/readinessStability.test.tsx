// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { installManualVerificationEnvironment, seedManualVerificationStorage } from '../mockEnvironment';
import { ManualVerificationScenarios } from '../scenarios';
import type { ManualVerificationView } from '../views';
import { MEDIA_FALLBACK_PATH } from '../../../app/assets/branding';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.clearAllMocks();
});

describe('manual verification readiness', () => {
  it('proves the dashboard against one canonical Fabric fixture without missing native APIs', async () => {
    seedManualVerificationStorage('dashboard');
    installManualVerificationEnvironment();
    const onReady = vi.fn();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    render(<ManualVerificationScenarios view="dashboard" onReady={onReady} />);

    await waitFor(() => expect(onReady).toHaveBeenCalledTimes(1), { timeout: 4000 });
    expect(screen.getAllByText(/Fabric/).length).toBeGreaterThan(1);
    expect(screen.queryByText('Vanilla')).toBeNull();
    await waitFor(() => expect(consoleError).not.toHaveBeenCalled());
  });

  it.each(['modpack-list', 'modpack-browser'] satisfies ManualVerificationView[])(
    'does not publish %s readiness again when inline proof arrays are recreated',
    async (view) => {
    seedManualVerificationStorage(view);
    installManualVerificationEnvironment();
    const onReady = vi.fn();
    const rendered = render(<ManualVerificationScenarios view={view} onReady={onReady} />);

    if (view === 'modpack-browser') {
      const proofImage = await screen.findByRole('img', { name: 'Alpha Pack' });
      proofImage.setAttribute('src', MEDIA_FALLBACK_PATH);
    }

    await waitFor(() => expect(onReady).toHaveBeenCalledTimes(1), { timeout: 4000 });

    rendered.rerender(<ManualVerificationScenarios view={view} onReady={onReady} />);

    await waitFor(() => expect(onReady).toHaveBeenCalledTimes(1));
    },
  );

  it('publishes degraded closeout readiness from the current visible error copy', async () => {
    window.history.replaceState({}, '', '?view=phase-24-degraded-closeout');
    seedManualVerificationStorage('phase-24-degraded-closeout');
    installManualVerificationEnvironment();
    const onReady = vi.fn();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    render(<ManualVerificationScenarios view="phase-24-degraded-closeout" onReady={onReady} />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Unable to search right now' })).toBeTruthy();
      expect(screen.getByRole('heading', { name: 'Failed to load screenshots.' })).toBeTruthy();
      expect(onReady).toHaveBeenCalledWith(
        'Phase 24 degraded closeout rendered inside the real shell with representative route and secondary-content failed-load proof.',
      );
    }, { timeout: 4000 });

    consoleError.mockRestore();
  });
});
