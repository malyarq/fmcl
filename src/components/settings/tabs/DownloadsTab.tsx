import React from 'react';
import { Input } from '../../ui/Input';

export interface DownloadsTabProps {
  downloadProvider: 'mojang' | 'bmcl' | 'auto';
  setDownloadProvider: (val: 'mojang' | 'bmcl' | 'auto') => void;
  autoDownloadThreads: boolean;
  setAutoDownloadThreads: (val: boolean) => void;
  downloadThreads: number;
  setDownloadThreads: (val: number) => void;
  maxSockets: number;
  setMaxSockets: (val: number) => void;
  t: (key: string) => string;
}

export const DownloadsTab: React.FC<DownloadsTabProps> = ({
  downloadProvider,
  setDownloadProvider,
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-3">
          <label className="text-sm font-medium text-zinc-600 dark:text-zinc-300 mb-2 block">
            {t('settings.download_provider')}
          </label>
          <select
            value={downloadProvider}
            onChange={(e) => setDownloadProvider(e.target.value as 'mojang' | 'bmcl' | 'auto')}
            className="w-full bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm border border-zinc-300/50 dark:border-zinc-700/50 rounded-lg p-3 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-600 shadow-sm hover:shadow-md transition-all"
          >
            <option value="auto">{t('settings.download_provider_auto')}</option>
            <option value="bmcl">{t('settings.download_provider_bmcl')}</option>
            <option value="mojang">{t('settings.download_provider_mojang')}</option>
          </select>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-white/60 dark:bg-zinc-900/60 backdrop-blur-sm rounded-xl border border-zinc-200/50 dark:border-zinc-800/50 shadow-sm hover:shadow-md transition-all">
            <div>
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-200">{t('settings.download_threads_auto')}</p>
              <p className="text-xs text-zinc-500">{t('settings.download_threads_auto_desc')}</p>
            </div>
            <input
              type="checkbox"
              checked={autoDownloadThreads}
              onChange={(e) => setAutoDownloadThreads(e.target.checked)}
              className="w-4 h-4 rounded cursor-pointer accent-current text-zinc-800 dark:text-white"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
  );
};

