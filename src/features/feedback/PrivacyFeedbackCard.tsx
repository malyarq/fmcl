import { useState } from 'react';
import { useSettings } from '../../contexts/SettingsContext';
import { useToast } from '../../contexts/ToastContext';
import { externalLinksIPC } from '../../services/ipc/externalLinksIPC';
import { systemReadinessIPC } from '../../services/ipc/systemReadinessIPC';
import { detectAnalyticsPlatform } from '../analytics/analyticsClient';
import { useAnalytics } from '../analytics/AnalyticsProvider';
import { Button } from '../../components/ui/Button';
import { buildGitHubIssueUrl, buildSafeIssueBody } from './issueReport';

export function PrivacyFeedbackCard() {
  const { language, t } = useSettings();
  const toast = useToast();
  const { capture, configured, enabled, setEnabled } = useAnalytics();
  const [openingReport, setOpeningReport] = useState(false);
  const platform = detectAnalyticsPlatform();
  const issueBody = buildSafeIssueBody({ analyticsEnabled: enabled, language, platform });

  const openIssue = async () => {
    setOpeningReport(true);
    try {
      const readiness = await systemReadinessIPC.check().catch(() => null);
      const result = await externalLinksIPC.open({
        url: buildGitHubIssueUrl(buildSafeIssueBody({ analyticsEnabled: enabled, language, platform, readiness })),
        context: 'Burrow bug report',
      });
      if (result.status === 'opened') {
        void capture('feedback_opened', { source: 'launcher_settings' });
      } else if (result.status === 'blocked') {
        toast.error(t('feedback.open_failed'));
      }
    } catch {
      toast.error(t('feedback.open_failed'));
    } finally {
      setOpeningReport(false);
    }
  };

  return (
    <div className="surface-card space-y-4 p-5" data-testid="privacy-feedback-card">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">{t('privacy.title')}</p>
        <p className="text-sm text-secondary">{t('privacy.description')}</p>
      </div>

      <div className="settings-toggle-row">
        <div className="settings-toggle-copy">
          <p className="settings-toggle-title">{t('privacy.analytics_title')}</p>
          <p className="settings-toggle-description">{t('privacy.analytics_description')}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label={t('privacy.analytics_title')}
          data-state={enabled ? 'checked' : 'unchecked'}
          onClick={() => setEnabled(!enabled)}
          className="settings-toggle-switch"
        >
          <span className="settings-toggle-thumb" data-state={enabled ? 'checked' : 'unchecked'} />
        </button>
      </div>

      <p className="text-xs text-secondary" role="status">
        {configured ? t('privacy.analytics_ready') : t('privacy.analytics_unavailable')}
      </p>

      <details className="surface-inline p-3 text-xs text-secondary">
        <summary className="cursor-pointer font-semibold text-foreground">{t('feedback.preview')}</summary>
        <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap break-words font-mono text-[0.72rem]">{issueBody}</pre>
      </details>

      <Button
        type="button"
        variant="secondary"
        geometry="utility"
        isLoading={openingReport}
        onClick={() => { void openIssue(); }}
        className="w-full"
      >
        {t('feedback.open_github')}
      </Button>
      <p className="text-xs text-secondary">{t('feedback.consent_notice')}</p>
    </div>
  );
}
