import type { RefObject } from 'react';
import { useSettings } from '../../contexts/SettingsContext';

export function ConsoleView(props: {
  logs: string[];
  logEndRef: RefObject<HTMLDivElement>;
  onCopyLogs: () => void;
}) {
  const { logs, logEndRef, onCopyLogs } = props;
  const { t } = useSettings();

  return (
    <div className="flex flex-col h-full p-6">
      <div className="flex justify-between items-center mb-4 flex-shrink-0">
        <h2 className="text-sm font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-zinc-400 dark:bg-zinc-600 animate-pulse"></span>
          {t('console.output')}
        </h2>
        <button
          onClick={onCopyLogs}
          className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
        >
          Copy
        </button>
      </div>
      <div className="flex-1 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm rounded-xl border border-zinc-200/50 dark:border-zinc-800/50 p-4 font-mono text-xs text-zinc-600 dark:text-zinc-400 overflow-y-auto custom-scrollbar shadow-2xl shadow-black/10 dark:shadow-black/30 select-text">
        {logs.length === 0 && (
          <div className="h-full flex items-center justify-center text-zinc-400 dark:text-zinc-700 opacity-50">
            Waiting for game...
          </div>
        )}
        {logs.map((log, i) => (
          <div key={i} className="mb-0.5 break-words leading-relaxed select-text">
            {log}
          </div>
        ))}
        <div ref={logEndRef} />
      </div>
    </div>
  );
}

