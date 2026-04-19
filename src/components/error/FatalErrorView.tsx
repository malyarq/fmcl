import { useEffect, useMemo, useRef, useState } from 'react';
import { createRuntimeTranslator } from '../../contexts/settings/i18n';
import { formatTechnicalErrorDetails, toRecoveryErrorMessage } from '../../utils/displayError';
import { DegradedStateView } from '../layout/DegradedStateView';
import { Button } from '../ui/Button';

export interface FatalErrorViewProps {
  error: Error | null;
  t?: (key: string) => string;
  technicalDetails?: string | null;
  onRestart?: () => void;
  onCopyDetails?: (details: string) => Promise<void> | void;
}

export function FatalErrorView({ error, t, technicalDetails, onRestart, onCopyDetails }: FatalErrorViewProps) {
  const [copied, setCopied] = useState(false);
  const [detailsVisible, setDetailsVisible] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const translator = useMemo(() => t ?? createRuntimeTranslator(), [t]);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  const details = useMemo(
    () => technicalDetails?.trim() || formatTechnicalErrorDetails(error),
    [error, technicalDetails],
  );
  const summary = useMemo(
    () => toRecoveryErrorMessage(error, translator('error.recovery_summary')),
    [error, translator],
  );

  const handleRestart = () => {
    if (onRestart) {
      onRestart();
      return;
    }

    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  const handleCopyDetails = async () => {
    const payload = details || translator('error.details_unavailable');

    if (onCopyDetails) {
      await onCopyDetails(payload);
    } else if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(payload);
    } else {
      return;
    }

    setCopied(true);
    if (copyTimerRef.current) {
      clearTimeout(copyTimerRef.current);
    }
    copyTimerRef.current = setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 py-10 text-foreground">
      <DegradedStateView
        variant="error"
        label={translator('error.recovery_label')}
        title={translator('error.something_went_wrong')}
        description={summary}
        footer={
          <>
            <Button onClick={handleRestart}>{translator('error.restart_launcher')}</Button>
            <Button variant="secondary" onClick={handleCopyDetails}>
              {copied ? translator('error.details_copied') : translator('error.copy_details')}
            </Button>
            <Button
              variant="ghost"
              aria-expanded={detailsVisible}
              onClick={() => setDetailsVisible((visible) => !visible)}
            >
              {detailsVisible ? translator('error.hide_details') : translator('error.technical_details')}
            </Button>
          </>
        }
      >
        <p className="text-sm leading-6 text-secondary">{translator('error.details_hint')}</p>
        {detailsVisible ? (
          <div className="rounded-2xl border border-border/70 bg-background/82 p-4">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
              {translator('error.technical_details')}
            </p>
            <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words text-xs leading-5 text-foreground">
              {details || translator('error.details_unavailable')}
            </pre>
          </div>
        ) : null}
      </DegradedStateView>
    </div>
  );
}
