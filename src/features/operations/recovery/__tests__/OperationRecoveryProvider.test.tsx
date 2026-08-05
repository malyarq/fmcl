// @vitest-environment jsdom

import type { OperationSnapshot } from '@shared/contracts';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTranslator } from '../../../../contexts/settings/i18n';
import { useOperationRecovery } from '../OperationRecoveryContext';
import { OperationRecoveryProvider } from '../OperationRecoveryProvider';

const listRecoveredMock = vi.fn();
const getMock = vi.fn();
const invalidateInstancesMock = vi.fn();
const setModeMock = vi.fn();

vi.mock('../../../../services/ipc/operationsIPC', () => ({
  operationsIPC: {
    listRecovered: (...args: unknown[]) => listRecoveredMock(...args),
    get: (...args: unknown[]) => getMock(...args),
  },
}));

vi.mock('../../../instances/hooks/useInstanceInvalidation', () => ({
  useInstanceInvalidation: () => ({
    invalidateInstance: vi.fn(),
    invalidateInstances: invalidateInstancesMock,
  }),
}));

vi.mock('../../../../contexts/SettingsContext', () => ({
  useSettings: () => ({
    t: createTranslator('en'),
    formatDate: () => 'Aug 4, 2026',
  }),
  useUIMode: () => ({ uiMode: 'simple', setMode: setModeMock }),
}));

describe('OperationRecoveryProvider', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.history.replaceState({}, '', '/');
    listRecoveredMock.mockReset();
    getMock.mockReset();
    invalidateInstancesMock.mockReset();
    invalidateInstancesMock.mockResolvedValue(undefined);
    setModeMock.mockReset();
  });

  it('bootstraps once and invalidates exactly once only for a recovered committed snapshot', async () => {
    listRecoveredMock.mockResolvedValue([
      operation('import-recovered', 'import', 'recovered'),
      operation('export-recovery', 'export', 'recovery-required'),
    ]);

    const view = render(
      <OperationRecoveryProvider><div>Current workspace</div></OperationRecoveryProvider>,
    );

    expect(await screen.findByText('Current workspace')).toBeTruthy();
    expect(await screen.findByText('Recovered after restart')).toBeTruthy();
    expect(screen.getByText('Needs manual attention')).toBeTruthy();
    await waitFor(() => expect(invalidateInstancesMock).toHaveBeenCalledTimes(1));
    expect(listRecoveredMock).toHaveBeenCalledTimes(1);

    view.rerender(
      <OperationRecoveryProvider><div>Current workspace updated</div></OperationRecoveryProvider>,
    );
    expect(await screen.findByText('Current workspace updated')).toBeTruthy();
    expect(listRecoveredMock).toHaveBeenCalledTimes(1);
    expect(invalidateInstancesMock).toHaveBeenCalledTimes(1);
  });

  it('hydrates inspected recovery and invalidates a newly proven commit only once', async () => {
    listRecoveredMock.mockResolvedValue([
      operation('import-recovery', 'import-share', 'recovery-required'),
    ]);
    getMock.mockResolvedValue(operation('import-recovery', 'import-share', 'recovered'));

    render(<OperationRecoveryProvider><div>Workspace</div></OperationRecoveryProvider>);

    fireEvent.click(await screen.findByRole('button', { name: 'Inspect Share import' }));

    await waitFor(() => expect(getMock).toHaveBeenCalledWith('import-recovery'));
    await waitFor(() => expect(invalidateInstancesMock).toHaveBeenCalledTimes(1));
    expect(screen.getByText('Recovered after restart')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Inspect Share import' }));
    await waitFor(() => expect(getMock).toHaveBeenCalledTimes(2));
    expect(invalidateInstancesMock).toHaveBeenCalledTimes(1);
  });

  it('rejects unexpected startup statuses instead of fabricating a recovery record', async () => {
    listRecoveredMock.mockResolvedValue([
      operation('degraded-record', 'install-modrinth', 'degraded'),
      {
        ...operation('contradictory-record', 'import', 'recovered'),
        phase: 'recovery-required',
      },
    ]);

    render(<OperationRecoveryProvider><div>Workspace remains</div></OperationRecoveryProvider>);

    expect(await screen.findByText('Workspace remains')).toBeTruthy();
    await waitFor(() => expect(listRecoveredMock).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId('operation-recovery-inbox')).toBeNull();
    expect(invalidateInstancesMock).not.toHaveBeenCalled();
  });

  it('keeps recovered records visible when canonical invalidation fails', async () => {
    listRecoveredMock.mockResolvedValue([
      operation('import-recovered', 'import', 'recovered'),
    ]);
    invalidateInstancesMock.mockRejectedValue(new Error('/Users/private/launcher state unavailable'));

    render(<OperationRecoveryProvider><div>Workspace remains</div></OperationRecoveryProvider>);

    expect(await screen.findByText('Recovered after restart')).toBeTruthy();
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Recovery records remain visible');
    expect(screen.getByTestId('operation-recovery-record-import-recovered')).toBeTruthy();
    expect(invalidateInstancesMock).toHaveBeenCalledTimes(1);
  });

  it('keeps bootstrap failure visible without reloading or inventing retry', async () => {
    listRecoveredMock.mockRejectedValue(new Error('Recovery journal unavailable'));
    window.history.replaceState({}, '', '/current-workspace?panel=settings');

    render(<OperationRecoveryProvider><div>Workspace remains</div></OperationRecoveryProvider>);

    const inbox = await screen.findByTestId('operation-recovery-inbox');
    expect(inbox.getAttribute('role')).toBe('alert');
    expect(inbox.textContent).toContain('Recovery journal unavailable');
    expect(screen.queryByRole('button', { name: /retry/i })).toBeNull();
    expect(window.location.pathname).toBe('/current-workspace');
    expect(window.location.search).toBe('?panel=settings');
  });

  it('rejects a malformed recovery envelope at the renderer boundary', async () => {
    listRecoveredMock.mockResolvedValue({ records: [] });

    render(<OperationRecoveryProvider><div>Workspace remains</div></OperationRecoveryProvider>);

    const inbox = await screen.findByTestId('operation-recovery-inbox');
    expect(inbox.getAttribute('role')).toBe('alert');
    expect(inbox.textContent).toContain('recovery journal returned an invalid result');
    expect(invalidateInstancesMock).not.toHaveBeenCalled();
  });

  it('exposes an explicit inbox refresh for in-place App recovery', async () => {
    listRecoveredMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([operation('import-recovered', 'import', 'recovered')]);

    render(
      <OperationRecoveryProvider>
        <RecoveryControl />
      </OperationRecoveryProvider>,
    );

    await waitFor(() => expect(listRecoveredMock).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: 'Refresh recovery inbox' }));

    expect(await screen.findByText('Recovered after restart')).toBeTruthy();
    expect(listRecoveredMock).toHaveBeenCalledTimes(2);
    expect(invalidateInstancesMock).not.toHaveBeenCalled();
  });

  it('keeps a dismissed recovery record closed after the provider restarts', async () => {
    listRecoveredMock.mockResolvedValue([
      operation('update-recovery', 'update', 'recovery-required'),
    ]);

    const first = render(
      <OperationRecoveryProvider><div>Workspace</div></OperationRecoveryProvider>,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Dismiss Update' }));
    expect(screen.queryByTestId('operation-recovery-inbox')).toBeNull();
    first.unmount();

    render(<OperationRecoveryProvider><div>Workspace restarted</div></OperationRecoveryProvider>);

    await waitFor(() => expect(listRecoveredMock).toHaveBeenCalledTimes(2));
    expect(screen.queryByTestId('operation-recovery-inbox')).toBeNull();
  });

  it('does not load or render the recovery inbox inside the debug console window', async () => {
    window.history.replaceState({}, '', '/#console');
    listRecoveredMock.mockResolvedValue([
      operation('update-recovery', 'update', 'recovery-required'),
    ]);

    render(<OperationRecoveryProvider><div>Debug console</div></OperationRecoveryProvider>);

    expect(await screen.findByText('Debug console')).toBeTruthy();
    expect(listRecoveredMock).not.toHaveBeenCalled();
    expect(screen.queryByTestId('operation-recovery-inbox')).toBeNull();
  });
});

function RecoveryControl() {
  const { refreshInbox } = useOperationRecovery();
  return <button onClick={() => { void refreshInbox(); }}>Refresh recovery inbox</button>;
}

function operation(
  id: string,
  kind: OperationSnapshot['kind'],
  status: OperationSnapshot['status'],
): OperationSnapshot {
  return {
    id,
    kind,
    status,
    phase: status === 'recovered' || status === 'degraded' ? 'completed' : 'recovery-required',
    progress: { completed: 1, total: 1 },
    createdAt: '2026-08-04T12:00:00.000Z',
    updatedAt: '2026-08-04T12:01:00.000Z',
    result: status === 'recovered'
      ? { status: 'recovered', instanceId: 'alpha' }
      : status === 'recovery-required'
        ? { status: 'recovery-required', message: 'Published files need review' }
        : status === 'degraded'
          ? { status: 'degraded', instanceId: 'alpha', missing: ['optional.jar'] }
          : undefined,
  };
}
