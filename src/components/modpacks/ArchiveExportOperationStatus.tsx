import type { OperationSnapshot } from '@shared/contracts';

export function ArchiveExportOperationStatus({
  operation,
  error,
  t,
}: {
  operation: OperationSnapshot | null;
  error: unknown;
  t: (key: string) => string;
}) {
  const status = operation?.status ?? (error ? 'failed' : null);
  if (!status) return null;
  const key = `modpacks.export_operation_${status}`;
  const translated = t(key);
  const label = translated === key ? status : translated;
  const message = operation?.result?.status === 'failed' || operation?.result?.status === 'recovery-required'
    ? operation.result.message
    : undefined;

  return (
    <div
      className={status === 'failed' || status === 'recovery-required' ? 'rounded-lg border border-red-500/30 bg-red-500/10 p-3' : 'rounded-lg border border-border/70 bg-card/78 p-3'}
      role={status === 'failed' || status === 'recovery-required' ? 'alert' : 'status'}
      data-testid="export-operation-status"
      data-operation-status={status}
    >
      <p className="text-sm text-foreground">{label}</p>
      {message && <p className="mt-1 text-sm text-secondary">{message}</p>}
    </div>
  );
}
