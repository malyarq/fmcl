import type { OperationSnapshot } from '@shared/contracts';
import type { CSSProperties } from 'react';
import { Button } from '../../ui/Button';
import { OperationStatusView } from '../../../features/operations/components/OperationStatusView';
import { ModpackDetailsActions } from './ModpackDetailsActions';
import type { ModpackDetailsUpdateState } from './useModpackDetailsController';

type Translate = (key: string) => string;
type AccentStyles = (type: 'bg' | 'text' | 'border' | 'ring' | 'hover' | 'accent' | 'title' | 'soft-bg' | 'soft-border') => {
  className?: string;
  style?: CSSProperties;
};

export interface ModpackDetailsActionBarProps {
  canDelete: boolean;
  getAccentStyles: AccentStyles;
  onDelete: () => void;
  onDuplicate: () => void;
  onExport: () => void;
  onLaunch: () => void;
  onRename: () => void;
  onRetryUpdate: () => void;
  onShowUpdate: () => void;
  t: Translate;
  updateState: ModpackDetailsUpdateState;
  updateVersionSummary: string | null;
}

export function ModpackDetailsActionBar({
  canDelete,
  getAccentStyles,
  onDelete,
  onDuplicate,
  onExport,
  onLaunch,
  onRename,
  onRetryUpdate,
  onShowUpdate,
  t,
  updateState,
  updateVersionSummary,
}: ModpackDetailsActionBarProps) {
  return (
    <div data-details-owner="actions" data-testid="modpack-details-action-bar" className="min-w-0">
      {updateState.status === 'loading' ? (
        <p role="status" className="mb-2 text-xs text-secondary">
          {t('modpacks.update_checking') || 'Checking for updates...'}
        </p>
      ) : null}
      {updateState.status === 'error' ? (
        <div role="alert" className="mb-2 rounded-xl border border-amber-500/25 bg-amber-500/8 p-3 text-xs text-secondary">
          <p>{t('modpacks.update_check_error') || 'Update status is unavailable. Launching remains available.'}</p>
          <Button variant="ghost" size="sm" onClick={onRetryUpdate} className="mt-1 px-0">
            {t('modpacks.retry_update_check') || 'Retry update check'}
          </Button>
        </div>
      ) : null}
      <ModpackDetailsActions
        onLaunch={onLaunch}
        hasUpdate={updateState.status === 'ready' && Boolean(updateState.update)}
        onShowUpdate={onShowUpdate}
        updateVersionSummary={updateVersionSummary}
        onRename={onRename}
        onDuplicate={onDuplicate}
        onExport={onExport}
        canDelete={canDelete}
        onDelete={onDelete}
        t={t}
        getAccentStyles={getAccentStyles}
      />
    </div>
  );
}

export interface ModpackDetailsOperationNoticesProps {
  cancelDelete: () => Promise<void>;
  cancelDuplicate: () => Promise<void>;
  deleteOperation: OperationSnapshot | null;
  deleteOperationError: unknown;
  duplicateOperation: OperationSnapshot | null;
  duplicateOperationError: unknown;
  retryDelete: () => Promise<void>;
  retryDuplicate: () => Promise<void>;
  t: Translate;
}

export function ModpackDetailsOperationNotices({
  cancelDelete,
  cancelDuplicate,
  deleteOperation,
  deleteOperationError,
  duplicateOperation,
  duplicateOperationError,
  retryDelete,
  retryDuplicate,
  t,
}: ModpackDetailsOperationNoticesProps) {
  if (!duplicateOperation && !duplicateOperationError && !deleteOperation && !deleteOperationError) {
    return null;
  }

  return (
    <div data-details-owner="operations" data-testid="modpack-details-operation-notices">
      <OperationStatusView
        snapshot={duplicateOperation}
        error={duplicateOperationError}
        onCancel={cancelDuplicate}
        onRetry={retryDuplicate}
        t={t}
        testId="details-duplicate-operation-status"
      />
      <OperationStatusView
        snapshot={deleteOperation}
        error={deleteOperationError}
        onCancel={cancelDelete}
        onRetry={retryDelete}
        t={t}
        testId="details-delete-operation-status"
      />
    </div>
  );
}
