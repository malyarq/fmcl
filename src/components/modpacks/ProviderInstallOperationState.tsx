import type { OperationSnapshot } from '@shared/contracts';
import { ProgressBar } from '../ui/ProgressBar';

type ProviderInstallOperationStateProps = {
  operation: OperationSnapshot;
  t: (key: string) => unknown;
};

export function ProviderInstallOperationState({ operation, t }: ProviderInstallOperationStateProps) {
  const isFailure = operation.status === 'failed' || operation.status === 'recovery-required';
  const missing = operation.result?.status === 'degraded' ? operation.result.missing : [];
  const isActive = ['queued', 'running', 'cancelling'].includes(operation.status);
  const message = operation.result?.status === 'failed' || operation.result?.status === 'recovery-required'
    ? operation.result.message
    : undefined;

  return (
    <div
      className={isFailure ? 'rounded-lg border border-red-500/30 bg-red-500/10 p-3' : 'rounded-lg border border-border/70 bg-muted/35 p-3'}
      data-testid="provider-install-operation"
      data-operation-status={operation.status}
      role={isFailure ? 'alert' : 'status'}
    >
      <p className={isFailure ? 'text-sm text-[rgb(var(--color-error))]' : 'text-sm text-foreground'}>
        {String(t(`modpacks.provider_operation_${operation.status}`))}
      </p>
      {message && <p className="mt-1 text-sm text-secondary">{message}</p>}
      {isActive && (
        <div className="mt-3">
          <ProgressBar
            value={operation.progress.total > 0 ? (operation.progress.completed / operation.progress.total) * 100 : 0}
            label={operation.progress.message || String(t(`modpacks.provider_operation_${operation.status}`))}
            valueLabel={operation.progress.total > 0 ? `${Math.round((operation.progress.completed / operation.progress.total) * 100)}%` : '0%'}
            animated
          />
        </div>
      )}
      {missing.length > 0 && (
        <ul className="mt-2 list-disc pl-5 text-sm text-secondary">
          {missing.map((item) => (
            <li key={typeof item === 'string' ? item : `${item.path}:${item.reason}`}>
              {typeof item === 'string' ? item : `${item.path}: ${item.reason}`}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
