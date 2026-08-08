import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, LoaderCircle, RefreshCw } from 'lucide-react';
import type { SystemReadinessCheck, SystemReadinessReport } from '@shared/contracts';
import { useSettings } from '../../contexts/SettingsContext';
import { systemReadinessIPC } from '../../services/ipc/systemReadinessIPC';
import { Button } from '../ui/Button';
import { cn } from '../../utils/cn';

const statusStyles: Record<SystemReadinessCheck['status'], string> = {
  ready: 'border-emerald-500/20 bg-emerald-500/8 text-emerald-700 dark:text-emerald-300',
  info: 'border-sky-500/20 bg-sky-500/8 text-sky-700 dark:text-sky-300',
  warning: 'border-amber-500/20 bg-amber-500/8 text-amber-700 dark:text-amber-300',
  blocked: 'border-red-500/20 bg-red-500/8 text-red-700 dark:text-red-300',
};

export function FirstRunReadiness() {
  const { t } = useSettings();
  const [available] = useState(() => systemReadinessIPC.isAvailable());
  const [report, setReport] = useState<SystemReadinessReport | null>(null);
  const [checking, setChecking] = useState(available);
  const [failed, setFailed] = useState(false);

  const runCheck = useCallback(async () => {
    setChecking(true);
    setFailed(false);
    try {
      setReport(await systemReadinessIPC.check());
    } catch {
      setFailed(true);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    if (available) void runCheck();
  }, [available, runCheck]);

  if (!available) return null;

  return (
    <section className="border-b border-border/60 px-6 py-3 sm:px-8" aria-labelledby="readiness-title">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {checking ? (
            <LoaderCircle className="h-4 w-4 animate-spin text-secondary" aria-hidden="true" />
          ) : report?.overall === 'ready' ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden="true" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-amber-500" aria-hidden="true" />
          )}
          <h2 id="readiness-title" className="text-sm font-bold text-foreground">
            {t('onboarding.readiness.title')}
          </h2>
          <span className="text-xs text-secondary" role="status">
            {checking
              ? t('onboarding.readiness.checking')
              : failed
                ? t('onboarding.readiness.failed')
                : t(`onboarding.readiness.${report?.overall ?? 'attention'}`)}
          </span>
        </div>
        {!checking && (failed || report?.overall !== 'ready') && (
          <Button variant="ghost" size="sm" onClick={() => { void runCheck(); }}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            {t('onboarding.readiness.retry')}
          </Button>
        )}
      </div>

      {report && (
        <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-4" data-testid="first-run-readiness">
          {report.checks.map((check) => (
            <div
              key={check.id}
              className={cn('rounded-xl border px-3 py-2 text-xs leading-5', statusStyles[check.status])}
            >
              <p className="font-semibold">{t(`onboarding.readiness.${check.id}.title`)}</p>
              <p>{t(`onboarding.readiness.${check.id}.${check.code}`)}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
