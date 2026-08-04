// @vitest-environment jsdom

import type { OperationSnapshot } from '@shared/contracts';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createTranslator } from '../../../../contexts/settings/i18n';
import { OperationRecoveryInbox } from '../OperationRecoveryInbox';

vi.mock('../../../../contexts/SettingsContext', () => ({
  useSettings: () => ({
    t: createTranslator('en'),
    formatDate: () => 'Aug 4, 2026',
  }),
}));

describe('OperationRecoveryInbox', () => {
  it('distinguishes recovered and recovery-required records without a generic retry action', () => {
    render(
      <OperationRecoveryInbox
        records={[
          operation('recovered', 'install-modrinth', 'recovered'),
          operation('required', 'export', 'recovery-required'),
        ]}
        selected={null}
        inspectingId={null}
        loadError={null}
        onInspect={vi.fn()}
        onDismiss={vi.fn()}
        onNavigate={vi.fn()}
      />,
    );

    const inbox = screen.getByTestId('operation-recovery-inbox');
    expect(inbox.textContent).toContain('Recovered after restart');
    expect(inbox.textContent).toContain('Needs manual attention');
    expect(inbox.textContent).toContain('Export authorization cannot be replayed');
    expect(screen.queryByRole('button', { name: /retry/i })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Open Modpacks for Export' })).toBeNull();
  });

  it('keeps inspect, dismiss and safe navigation as native keyboard-focusable actions', () => {
    const onInspect = vi.fn();
    const onDismiss = vi.fn();
    const onNavigate = vi.fn();
    window.history.replaceState({}, '', '/current-workspace?panel=settings');

    render(
      <OperationRecoveryInbox
        records={[operation('required', 'update', 'recovery-required')]}
        selected={null}
        inspectingId={null}
        loadError={null}
        onInspect={onInspect}
        onDismiss={onDismiss}
        onNavigate={onNavigate}
      />,
    );

    const record = screen.getByTestId('operation-recovery-record-required');
    const inspect = within(record).getByRole('button', { name: 'Inspect Update' });
    const navigate = within(record).getByRole('button', { name: 'Open Modpacks for Update' });
    const dismiss = within(record).getByRole('button', { name: 'Dismiss Update' });

    for (const button of [inspect, navigate, dismiss]) {
      button.focus();
      expect(document.activeElement).toBe(button);
    }

    fireEvent.click(inspect);
    fireEvent.click(navigate);
    fireEvent.click(dismiss);
    expect(onInspect).toHaveBeenCalledWith('required');
    expect(onNavigate).toHaveBeenCalledWith('update');
    expect(onDismiss).toHaveBeenCalledWith('required');
    expect(window.location.pathname).toBe('/current-workspace');
    expect(window.location.search).toBe('?panel=settings');
  });

  it('renders inspected safe details without exposing paths or hidden request intent', () => {
    const inspected = operation('required', 'import', 'recovery-required');
    render(
      <OperationRecoveryInbox
        records={[inspected]}
        selected={inspected}
        inspectingId={null}
        loadError={null}
        onInspect={vi.fn()}
        onDismiss={vi.fn()}
        onNavigate={vi.fn()}
      />,
    );

    const details = screen.getByTestId('operation-recovery-details-required');
    expect(details.textContent).toContain('Published files need review');
    expect(details.textContent).toContain('Aug 4, 2026');
    expect(details.textContent).not.toContain('/Users/');
    expect(details.textContent).not.toContain('archiveRef');
    expect(details.textContent).not.toContain('outputPath');
  });
});

function operation(
  id: string,
  kind: OperationSnapshot['kind'],
  status: 'recovered' | 'recovery-required',
): OperationSnapshot {
  return {
    id,
    kind,
    status,
    phase: status === 'recovered' ? 'completed' : 'recovery-required',
    progress: { completed: 1, total: 1 },
    createdAt: '2026-08-04T12:00:00.000Z',
    updatedAt: '2026-08-04T12:01:00.000Z',
    result: status === 'recovered'
      ? { status: 'recovered', instanceId: 'alpha' }
      : { status: 'recovery-required', message: 'Published files need review' },
  };
}
