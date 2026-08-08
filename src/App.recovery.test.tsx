// @vitest-environment jsdom

import { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRecoveryBoundary } from './App';
import { ModpackNavigationProvider } from './features/modpacks/navigation/ModpackNavigationProvider';
import { usePersistentModpackNavigation } from './features/modpacks/navigation/ModpackNavigationContext';

const invalidateInstancesMock = vi.fn();
const recoverOperationsMock = vi.fn();
let crashOnNextRender = false;
const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

vi.mock('./features/instances/hooks/useInstanceInvalidation', () => ({
  useInstanceInvalidation: () => ({
    invalidateInstance: vi.fn(),
    invalidateInstances: invalidateInstancesMock,
  }),
}));

vi.mock('./features/operations/recovery/OperationRecoveryContext', () => ({
  useOperationRecovery: () => ({ refreshInbox: recoverOperationsMock }),
}));

vi.mock('./contexts/SettingsContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./contexts/SettingsContext')>();
  return {
    ...actual,
    useSettings: () => ({ t: (key: string) => ({
      'error.recovery_label': 'Recovery',
      'error.something_went_wrong': 'Something Went Wrong',
      'error.feature_recovery_summary': 'Recover this screen in place.',
      'error.recover_screen': 'Recover screen',
      'error.recovering': 'Recovering…',
      'error.recover_failed': 'Burrow could not recover this screen. Your current route is unchanged.',
      'error.copy_details': 'Copy details',
      'error.details_copied': 'Details copied',
      'error.technical_details': 'Technical details',
      'error.hide_details': 'Hide details',
      'error.details_hint': 'Copy details if this keeps happening.',
      'error.details_unavailable': 'No details.',
    } as Record<string, string>)[key] ?? key }),
  };
});

function RouteProbe() {
  const navigation = usePersistentModpackNavigation();
  const [, setRevision] = useState(0);

  if (crashOnNextRender) {
    throw new Error('details route crashed');
  }

  return (
    <div>
      <span data-testid="current-route">{navigation.view.type}</span>
      <button onClick={() => navigation.navigate({ type: 'details', modpackId: 'alpha' })}>Open details</button>
      <button onClick={() => {
        crashOnNextRender = true;
        setRevision((current) => current + 1);
      }}>Crash route</button>
      <button onClick={navigation.goBack}>Go back</button>
    </div>
  );
}

describe('App in-place recovery boundary', () => {
  beforeEach(() => {
    invalidateInstancesMock.mockReset().mockResolvedValue(undefined);
    recoverOperationsMock.mockReset().mockImplementation(async () => {
      crashOnNextRender = false;
    });
    crashOnNextRender = false;
    consoleErrorSpy.mockClear();
    window.history.replaceState({}, '', '/workspace?view=details');
  });

  afterAll(() => {
    consoleErrorSpy.mockRestore();
  });

  it('recovers singleton queries and inbox while preserving route history', async () => {
    render(
      <ModpackNavigationProvider>
        <AppRecoveryBoundary>
          <RouteProbe />
        </AppRecoveryBoundary>
      </ModpackNavigationProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open details' }));
    expect(screen.getByTestId('current-route').textContent).toBe('details');

    fireEvent.click(screen.getByRole('button', { name: 'Crash route' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Recover screen' }));

    await waitFor(() => expect(screen.getByTestId('current-route').textContent).toBe('details'));
    expect(invalidateInstancesMock).toHaveBeenCalledTimes(1);
    expect(recoverOperationsMock).toHaveBeenCalledTimes(1);
    expect(window.location.pathname).toBe('/workspace');
    expect(window.location.search).toBe('?view=details');

    fireEvent.click(screen.getByRole('button', { name: 'Go back' }));
    await waitFor(() => expect(screen.getByTestId('current-route').textContent).toBe('list'));
  });
});
