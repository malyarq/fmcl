import type { OperationSnapshot, OperationStatus } from '@shared/contracts';
import { toDisplayErrorMessage } from '../../../utils/displayError';
import {
  classifyOperationTerminal,
  type OperationTerminalClassification,
} from '../operationTerminalPolicy';

type Translate = (key: string, params?: Record<string, string | number>) => string;

export type OperationStatusViewProps = {
  snapshot: OperationSnapshot | null;
  classification?: OperationTerminalClassification | null;
  error?: unknown;
  errorFallback?: string;
  onCancel?: () => Promise<void> | void;
  onRetry?: () => Promise<void> | void;
  onReset?: () => void;
  t?: Translate;
  testId?: string;
};

const STATUS_LABELS: Record<OperationStatus, string> = {
  queued: 'Operation queued',
  running: 'Operation in progress',
  cancelling: 'Cancelling operation',
  succeeded: 'Operation completed',
  recovered: 'Operation recovered after restart',
  degraded: 'Operation completed with missing optional items',
  cancelled: 'Operation cancelled',
  failed: 'Operation failed',
  'recovery-required': 'Operation recovery needs attention',
};

function translate(t: Translate | undefined, key: string, fallback: string) {
  const translated = t?.(key);
  return translated && translated !== key ? translated : fallback;
}

function resultMessage(snapshot: OperationSnapshot | null) {
  const result = snapshot?.result;
  return result?.status === 'failed' || result?.status === 'recovery-required'
    ? result.message
    : undefined;
}

function missingItemLabel(item: string | { path: string; reason: string }) {
  return typeof item === 'string' ? item : `${item.path}: ${item.reason}`;
}

export function OperationStatusView({
  snapshot,
  classification,
  error,
  errorFallback,
  onCancel,
  onRetry,
  onReset,
  t,
  testId = 'operation-status',
}: OperationStatusViewProps) {
  const status = snapshot?.status ?? (error ? 'failed' : null);
  if (!status) return null;

  const terminal = classification ?? (snapshot ? classifyOperationTerminal(snapshot) : null);
  const isAlert = Boolean(error) || status === 'failed' || status === 'recovery-required';
  const isActive = status === 'queued' || status === 'running' || status === 'cancelling';
  const message = error
    ? toDisplayErrorMessage(
        error,
        errorFallback ?? translate(t, 'operations.error', 'The operation could not be completed.'),
      )
    : resultMessage(snapshot);
  const missing = snapshot?.result?.status === 'degraded' ? snapshot.result.missing : [];
  const progress = snapshot?.progress;
  const progressTotal = Math.max(progress?.total ?? 1, 1);
  const progressValue = Math.min(Math.max(progress?.completed ?? 0, 0), progressTotal);
  const className = isAlert
    ? 'rounded-lg border border-red-500/30 bg-red-500/10 p-3'
    : status === 'degraded'
      ? 'rounded-lg border border-amber-500/30 bg-amber-500/10 p-3'
      : 'rounded-lg border border-border/70 bg-card/78 p-3';
  const showRetry = Boolean(onRetry && terminal?.isTerminal && !terminal.isPresentationSuccess);
  const showReset = Boolean(onReset && terminal?.isTerminal);
  const presentationSuccess = !error && Boolean(terminal?.isPresentationSuccess);

  return (
    <div
      className={className}
      role={isAlert ? 'alert' : 'status'}
      aria-live={isAlert ? 'assertive' : 'polite'}
      aria-atomic="true"
      data-testid={testId}
      data-operation-status={status}
      data-operation-committed={String(terminal?.didCommit ?? false)}
      data-presentation-success={String(presentationSuccess)}
    >
      <p className="text-sm font-medium text-foreground">
        {translate(t, `operations.status.${status}`, STATUS_LABELS[status])}
      </p>
      {progress?.message && isActive && <p className="mt-1 text-sm text-secondary">{progress.message}</p>}
      {progress && isActive && (
        <progress
          className="mt-2 h-2 w-full"
          max={progressTotal}
          value={progressValue}
          aria-label={translate(t, 'operations.progress', 'Operation progress')}
        />
      )}
      {message && <p className="mt-1 text-sm text-secondary">{message}</p>}
      {missing.length > 0 && (
        <ul className="mt-2 list-disc pl-5 text-sm text-secondary">
          {missing.map((item) => {
            const label = missingItemLabel(item);
            return <li key={label}>{label}</li>;
          })}
        </ul>
      )}
      {(onCancel && isActive) || showRetry || showReset ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {onCancel && isActive && (
            <button type="button" className="rounded-md border border-border px-3 py-1.5 text-sm" onClick={onCancel} disabled={status === 'cancelling'}>
              {translate(t, 'operations.cancel', 'Cancel')}
            </button>
          )}
          {showRetry && (
            <button type="button" className="rounded-md border border-border px-3 py-1.5 text-sm" onClick={onRetry}>
              {translate(t, 'operations.retry', 'Retry')}
            </button>
          )}
          {showReset && (
            <button type="button" className="rounded-md border border-border px-3 py-1.5 text-sm" onClick={onReset}>
              {translate(t, 'operations.dismiss', 'Dismiss')}
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
