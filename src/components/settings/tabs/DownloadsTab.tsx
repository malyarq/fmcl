import React from 'react';
import { Input } from '../../ui/Input';
import { MirrorsSettings } from '../../../features/settings/mirrors/MirrorsSettings';

export interface DownloadsTabProps {
  autoDownloadThreads: boolean;
  setAutoDownloadThreads: (val: boolean) => void;
  downloadThreads: number;
  setDownloadThreads: (val: number) => void;
  maxSockets: number;
  setMaxSockets: (val: number) => void;
  t: (key: string) => string;
  embedded?: boolean;
}

export const DownloadsTab: React.FC<DownloadsTabProps> = ({
  autoDownloadThreads,
  setAutoDownloadThreads,
  downloadThreads,
  setDownloadThreads,
  maxSockets,
  setMaxSockets,
  t,
  embedded = false,
}) => {
  const tuningSectionClassName = embedded
    ? 'surface-muted settings-section-stack min-w-0 p-5'
    : 'settings-section-shell settings-section-stack min-w-0 p-5';

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(19rem,0.85fr)]">
      <div className="min-w-0 space-y-4">
        {!embedded && (
          <div className="settings-section-shell settings-section-copy p-5">
            <div className="kicker-label">{t('settings.downloads')}</div>
            <h3 className="text-lg font-bold text-foreground">{t('settings.downloads')}</h3>
            <p className="settings-embedded-copy">{t('settings.downloadsHint')}</p>
          </div>
        )}

        <MirrorsSettings embedded={embedded} />
      </div>

      <div className={tuningSectionClassName} data-testid="downloads-tuning-section">
        <div className="settings-section-copy">
          <h4 className="settings-embedded-title">{t('settings.downloadsTuningTitle')}</h4>
          <p className="settings-embedded-copy">{t('settings.downloadsTuningHint')}</p>
        </div>

        <div className="settings-toggle-row">
          <div className="settings-toggle-copy">
            <h5 className="settings-toggle-title">{t('settings.download_threads_auto')}</h5>
            <p id="settings-auto-threads-hint" className="settings-toggle-description">
              {t('settings.download_threads_auto_desc')}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={autoDownloadThreads}
            aria-describedby="settings-auto-threads-hint"
            aria-label={t('settings.download_threads_auto')}
            data-state={autoDownloadThreads ? 'checked' : 'unchecked'}
            onClick={() => setAutoDownloadThreads(!autoDownloadThreads)}
            className="settings-toggle-switch"
          >
            <span
              className="settings-toggle-thumb"
              data-state={autoDownloadThreads ? 'checked' : 'unchecked'}
            />
          </button>
        </div>

        <div className="settings-control-card grid grid-cols-1 gap-4">
          <Input
            label={t('settings.download_threads')}
            type="number"
            min={1}
            value={downloadThreads}
            onChange={(e) => setDownloadThreads(parseInt(e.target.value || '1', 10))}
            placeholder="8"
            disabled={autoDownloadThreads}
          />
          <Input
            label={t('settings.max_sockets')}
            type="number"
            min={1}
            value={maxSockets}
            onChange={(e) => setMaxSockets(parseInt(e.target.value || '1', 10))}
            placeholder="64"
          />
        </div>
      </div>
    </div>
  );
};
