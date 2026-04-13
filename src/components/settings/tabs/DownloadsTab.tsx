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
}

export const DownloadsTab: React.FC<DownloadsTabProps> = ({
  autoDownloadThreads,
  setAutoDownloadThreads,
  downloadThreads,
  setDownloadThreads,
  maxSockets,
  setMaxSockets,
  t,
}) => {
  return (
    <div className="space-y-4">
      <div className="surface-card space-y-2 p-4">
        <div className="kicker-label">{t('settings.downloads')}</div>
        <h3 className="text-lg font-bold text-foreground">{t('settings.downloads')}</h3>
        <p className="text-sm text-secondary">{t('settings.downloadsHint')}</p>
      </div>

      <MirrorsSettings />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="surface-card p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-foreground">{t('settings.download_threads_auto')}</h4>
              <p id="settings-auto-threads-hint" className="text-sm text-secondary">
                {t('settings.download_threads_auto_desc')}
              </p>
            </div>
            <input
              type="checkbox"
              checked={autoDownloadThreads}
              onChange={(e) => setAutoDownloadThreads(e.target.checked)}
              aria-describedby="settings-auto-threads-hint"
              className="mt-1 h-4 w-4 cursor-pointer rounded border-border/70 bg-card text-[rgb(var(--accent-main))] focus:ring-[rgb(var(--accent-main))] focus:ring-offset-background"
            />
          </div>
        </div>

        <div className="surface-card space-y-4 p-4">
          <div className="space-y-1">
            <h4 className="text-sm font-semibold text-foreground">{t('settings.downloadsTuningTitle')}</h4>
            <p className="text-sm text-secondary">{t('settings.downloadsTuningHint')}</p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
    </div>
  );
};
