// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { OperationSnapshot, OperationStatus } from '@shared/contracts';
import { classifyOperationTerminal } from '../../operationTerminalPolicy';
import { OperationStatusView } from '../OperationStatusView';

function operation(status: OperationStatus): OperationSnapshot {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    kind: 'import',
    status,
    phase: status === 'failed'
      ? 'failed'
      : status === 'recovery-required'
        ? 'recovery-required'
        : status === 'queued' || status === 'running' || status === 'cancelling'
          ? 'started'
          : 'completed',
    progress: { completed: status === 'running' ? 1 : 0, total: 4, message: 'Installing files' },
    createdAt: '2026-08-04T00:00:00.000Z',
    updatedAt: '2026-08-04T00:00:01.000Z',
    result: status === 'succeeded'
      ? { status, instanceId: 'published-instance' }
      : status === 'degraded'
        ? { status, instanceId: 'published-instance', missing: ['optional.jar', { path: 'extra.jar', reason: 'not found' }] }
        : status === 'failed'
          ? { status, code: 'FAILED', message: 'Could not publish the instance' }
          : status === 'recovery-required'
            ? { status, message: 'Restore the backup before retrying' }
            : undefined,
  };
}

const t = (key: string) => key;

describe('OperationStatusView', () => {
  it('announces active progress politely and exposes cancellation', () => {
    const onCancel = vi.fn();
    const snapshot = operation('running');
    render(<OperationStatusView snapshot={snapshot} classification={classifyOperationTerminal(snapshot)} onCancel={onCancel} t={t} />);

    const status = screen.getByRole('status');
    expect(status.getAttribute('aria-live')).toBe('polite');
    expect(status.getAttribute('data-operation-status')).toBe('running');
    expect(screen.getByRole('progressbar').getAttribute('value')).toBe('1');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('keeps degraded publication visible and actionable without success semantics', () => {
    const onRetry = vi.fn();
    const onReset = vi.fn();
    const snapshot = operation('degraded');
    render(
      <OperationStatusView
        snapshot={snapshot}
        classification={classifyOperationTerminal(snapshot)}
        onRetry={onRetry}
        onReset={onReset}
        t={t}
      />,
    );

    const status = screen.getByRole('status');
    expect(status.getAttribute('data-operation-committed')).toBe('true');
    expect(status.getAttribute('data-presentation-success')).toBe('false');
    expect(status.textContent).toContain('optional.jar');
    expect(status.textContent).toContain('extra.jar: not found');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it.each(['failed', 'recovery-required'] as const)('announces %s assertively with its safe message', (terminalStatus) => {
    const snapshot = operation(terminalStatus);
    render(<OperationStatusView snapshot={snapshot} classification={classifyOperationTerminal(snapshot)} t={t} />);

    const alert = screen.getByRole('alert');
    expect(alert.getAttribute('aria-live')).toBe('assertive');
    expect(alert.getAttribute('data-presentation-success')).toBe('false');
    expect(alert.textContent).toContain(terminalStatus === 'failed'
      ? 'Could not publish the instance'
      : 'Restore the backup before retrying');
  });

  it('renders no false success when an external session error exists', () => {
    render(<OperationStatusView snapshot={null} classification={null} error={new Error('Subscription failed')} t={t} />);

    const alert = screen.getByRole('alert');
    expect(alert.getAttribute('data-operation-status')).toBe('failed');
    expect(alert.getAttribute('data-presentation-success')).toBe('false');
    expect(alert.textContent).toContain('Subscription failed');
  });

  it('suppresses presentation success when a committed follow-up effect fails', () => {
    const snapshot = operation('succeeded');
    render(
      <OperationStatusView
        snapshot={snapshot}
        classification={classifyOperationTerminal(snapshot)}
        error={new Error('Canonical invalidation failed')}
        t={t}
      />,
    );

    const alert = screen.getByRole('alert');
    expect(alert.getAttribute('data-operation-committed')).toBe('true');
    expect(alert.getAttribute('data-presentation-success')).toBe('false');
    expect(alert.textContent).toContain('Canonical invalidation failed');
  });
});
