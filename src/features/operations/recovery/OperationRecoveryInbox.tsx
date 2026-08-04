import type { OperationKind, OperationSnapshot } from '@shared/contracts';
import { AlertTriangle, CheckCircle2, ExternalLink, Search, X } from 'lucide-react';
import { useSettings } from '../../../contexts/SettingsContext';
import { cn } from '../../../utils/cn';
import { toRecoveryErrorMessage } from '../../../utils/displayError';
import { Button } from '../../../components/ui/Button';
import { getOperationRecoveryDestination } from './operationRecoveryPolicy';

export type OperationRecoveryInboxProps = {
  records: readonly OperationSnapshot[];
  selected: OperationSnapshot | null;
  inspectingId: string | null;
  loadError: unknown | null;
  onInspect: (operationId: string) => void;
  onDismiss: (operationId: string) => void;
  onNavigate: (kind: OperationKind) => void;
};

const KIND_LABELS: Record<OperationKind, string> = {
  duplicate: 'Duplicate',
  import: 'Archive import',
  'import-share': 'Share import',
  'install-curseforge': 'CurseForge install',
  'install-modrinth': 'Modrinth install',
  update: 'Update',
  delete: 'Delete',
  export: 'Export',
};

export function OperationRecoveryInbox({
  records,
  selected,
  inspectingId,
  loadError,
  onInspect,
  onDismiss,
  onNavigate,
}: OperationRecoveryInboxProps) {
  const { t, formatDate } = useSettings();
  if (records.length === 0 && !loadError) return null;

  if (loadError && records.length === 0) {
    return (
      <aside
        role="alert"
        aria-live="assertive"
        data-testid="operation-recovery-inbox"
        className={inboxClassName}
      >
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-300" aria-hidden="true" />
          <div className="min-w-0 space-y-1">
            <h2 className="text-sm font-semibold text-foreground">
              {translate(t, 'operations.recovery_inbox_error_title', 'Recovery records are unavailable')}
            </h2>
            <p className="text-sm leading-5 text-secondary">
              {toRecoveryErrorMessage(
                loadError,
                translate(
                  t,
                  'operations.recovery_inbox_error_desc',
                  'FMCL could not read the recovery journal. Your current workspace remains unchanged.',
                ),
              )}
            </p>
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside
      role="region"
      aria-label={translate(t, 'operations.recovery_inbox_title', 'Operation recovery')}
      aria-live="polite"
      data-testid="operation-recovery-inbox"
      className={inboxClassName}
    >
      <header className="flex items-start justify-between gap-4 border-b border-border/70 pb-3">
        <div className="min-w-0">
          <div className="kicker-label">
            {translate(t, 'operations.recovery_inbox_label', 'Startup recovery')}
          </div>
          <h2 className="mt-1 text-base font-semibold text-foreground">
            {translate(t, 'operations.recovery_inbox_title', 'Operation recovery')}
          </h2>
          <p className="mt-1 text-xs leading-5 text-secondary">
            {translate(
              t,
              'operations.recovery_inbox_desc',
              'These operations outlived their original screen. Inspect or dismiss them without replaying hidden input.',
            )}
          </p>
        </div>
        <span className="rounded-full border border-border/70 bg-background/70 px-2.5 py-1 text-xs text-secondary">
          {records.length}
        </span>
      </header>

      {loadError ? (
        <div
          role="alert"
          className="mt-3 rounded-xl border border-red-500/25 bg-red-500/8 p-3 text-xs leading-5 text-secondary"
        >
          {toRecoveryErrorMessage(
            loadError,
            translate(
              t,
              'operations.recovery_inbox_effect_error',
              'Recovery records remain visible, but canonical instance state could not be refreshed.',
            ),
          )}
        </div>
      ) : null}

      <ul className="mt-3 max-h-[min(60vh,32rem)] space-y-3 overflow-y-auto pr-1" role="list">
        {records.map((snapshot) => {
          const kindLabel = operationKindLabel(snapshot.kind, t);
          const isRecovered = snapshot.status === 'recovered';
          const isSelected = selected?.id === snapshot.id;
          const canNavigate = getOperationRecoveryDestination(snapshot.kind) !== null;
          return (
            <li key={snapshot.id}>
              <article
                data-testid={`operation-recovery-record-${snapshot.id}`}
                className={cn(
                  'rounded-2xl border p-3',
                  isRecovered
                    ? 'border-emerald-500/25 bg-emerald-500/8'
                    : 'border-amber-500/25 bg-amber-500/8',
                )}
              >
                <div className="flex items-start gap-3">
                  {isRecovered ? (
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" aria-hidden="true" />
                  ) : (
                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" aria-hidden="true" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">{kindLabel}</p>
                    <p className="mt-0.5 text-xs font-medium text-secondary">
                      {isRecovered
                        ? translate(t, 'operations.recovery_inbox_recovered', 'Recovered after restart')
                        : translate(t, 'operations.recovery_inbox_required', 'Needs manual attention')}
                    </p>
                    <p className="mt-2 text-xs leading-5 text-secondary">
                      {recoveryGuidance(snapshot.kind, isRecovered, t)}
                    </p>
                  </div>
                </div>

                {isSelected ? (
                  <RecoveryDetails snapshot={selected} formatDate={formatDate} t={t} />
                ) : null}

                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => onInspect(snapshot.id)}
                    isLoading={inspectingId === snapshot.id}
                    aria-expanded={isSelected}
                    aria-controls={`operation-recovery-details-${snapshot.id}`}
                    aria-label={`${translate(t, 'operations.recovery_inbox_inspect', 'Inspect')} ${kindLabel}`}
                  >
                    <Search className="h-4 w-4" aria-hidden="true" />
                    {translate(t, 'operations.recovery_inbox_inspect', 'Inspect')}
                  </Button>
                  {canNavigate ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => onNavigate(snapshot.kind)}
                      aria-label={`${translate(t, 'operations.recovery_inbox_open_modpacks', 'Open Modpacks for')} ${kindLabel}`}
                    >
                      <ExternalLink className="h-4 w-4" aria-hidden="true" />
                      {translate(t, 'operations.recovery_inbox_open_modpacks_short', 'Open Modpacks')}
                    </Button>
                  ) : null}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDismiss(snapshot.id)}
                    aria-label={`${translate(t, 'operations.dismiss', 'Dismiss')} ${kindLabel}`}
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                    {translate(t, 'operations.dismiss', 'Dismiss')}
                  </Button>
                </div>
              </article>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}

function RecoveryDetails({
  snapshot,
  formatDate,
  t,
}: {
  snapshot: OperationSnapshot;
  formatDate: (timestamp: number | undefined, unknownText?: string, options?: Intl.DateTimeFormatOptions) => string;
  t: (key: string) => string;
}) {
  const resultMessage = snapshot.result?.status === 'recovery-required'
    ? toRecoveryErrorMessage(
        snapshot.result.message,
        translate(t, 'operations.recovery_inbox_required_desc', 'FMCL could not prove a safe automatic recovery.'),
      )
    : translate(
        t,
        'operations.recovery_inbox_recovered_desc',
        'FMCL verified that this operation reached durable completion.',
      );
  const updatedAt = Date.parse(snapshot.updatedAt);

  return (
    <div
      id={`operation-recovery-details-${snapshot.id}`}
      data-testid={`operation-recovery-details-${snapshot.id}`}
      className="mt-3 space-y-1 rounded-xl border border-border/60 bg-background/55 p-3 text-xs leading-5 text-secondary"
    >
      <p>{resultMessage}</p>
      <p>
        {translate(t, 'operations.recovery_inbox_updated', 'Last journal update')}: {' '}
        {formatDate(Number.isFinite(updatedAt) ? updatedAt : undefined, translate(t, 'general.unknown', 'Unknown'))}
      </p>
    </div>
  );
}

function recoveryGuidance(
  kind: OperationKind,
  isRecovered: boolean,
  t: (key: string) => string,
) {
  if (isRecovered) {
    return translate(
      t,
      'operations.recovery_inbox_recovered_guidance',
      'The durable result is available. Open Modpacks to review current canonical state.',
    );
  }
  if (kind === 'export') {
    return translate(
      t,
      'operations.recovery_inbox_export_guidance',
      'Export authorization cannot be replayed. Open the instance later and choose a new destination if another export is needed.',
    );
  }
  return translate(
    t,
    'operations.recovery_inbox_required_guidance',
    'FMCL cannot safely replay the original request. Open Modpacks to inspect current state before taking a new action.',
  );
}

function operationKindLabel(kind: OperationKind, t: (key: string) => string) {
  return translate(t, `operations.kind.${kind}`, KIND_LABELS[kind]);
}

function translate(t: (key: string) => string, key: string, fallback: string) {
  const translated = t(key);
  return translated && translated !== key ? translated : fallback;
}

const inboxClassName = 'surface-card fixed bottom-4 right-4 z-[120] w-[min(28rem,calc(100vw-2rem))] rounded-[24px] border border-border/80 p-4 shadow-2xl';
