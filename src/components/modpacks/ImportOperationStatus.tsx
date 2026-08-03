import React from 'react';
import type { OperationSnapshot } from '@shared/contracts';

type ImportOperationStatusProps = {
  operation: OperationSnapshot | null;
  error: unknown;
  t: (key: string) => string;
};

export const ImportOperationStatus: React.FC<ImportOperationStatusProps> = ({ operation, error, t }) => {
  const status = operation?.status ?? (error ? 'failed' : null);
  if (!status) return null;

  const key = `modpacks.import_operation_${status}`;
  const translated = t(key);
  const label = translated === key ? status : translated;
  const missing = operation?.result?.status === 'degraded' ? operation.result.missing : [];

  return (
    <div className="rounded-lg border border-border/70 bg-card/78 p-3" role="status" data-testid="import-operation-status">
      {label}
      {missing.length > 0 && (
        <ul className="mt-2 list-disc pl-5 text-sm text-secondary">
          {missing.map((item) => <li key={typeof item === 'string' ? item : `${item.path}:${item.reason}`}>{typeof item === 'string' ? item : `${item.path}: ${item.reason}`}</li>)}
        </ul>
      )}
    </div>
  );
};
