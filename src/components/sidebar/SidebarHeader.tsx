import type { CSSProperties } from 'react';
import { Button } from '../ui/Button';
import { cn } from '../../utils/cn';

export function SidebarHeader(props: {
  appVersion: string;
  onShowMultiplayer: () => void;
  onShowSettings: () => void;
  getAccentStyles: (type: 'text') => { className?: string; style?: CSSProperties };
  getAccentHex: () => string;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  t: (key: string) => string;
}) {
  const { appVersion, onShowMultiplayer, onShowSettings, getAccentStyles, getAccentHex, isCollapsed, onToggleCollapse, t } = props;

  if (isCollapsed) {
    return (
      <div className="flex flex-col items-center mb-4">
        {onToggleCollapse && (
          <button 
            onClick={onToggleCollapse} 
            className="px-2 py-1 mb-2 text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-100/50 dark:hover:bg-zinc-800/50 rounded transition-colors"
          >
            <span className="text-lg">☰</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="mb-8">
      <div className="flex justify-between items-start mb-2">
        <div>
          <h1
            className={cn('text-2xl font-black tracking-tighter drop-shadow-sm', getAccentStyles('text').className)}
            style={{
              ...getAccentStyles('text').style,
              textShadow: `0 2px 8px ${getAccentHex()}30`,
            }}
          >
            FriendLauncher
          </h1>
          <p className="text-[10px] text-zinc-500 font-mono mt-1 opacity-70">BUILD v{appVersion}</p>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={onShowMultiplayer} className="px-2" title={t('multiplayer.title') || 'Multiplayer'}>
            <span className="text-lg">🌐</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={onShowSettings} className="px-2" title={t('general.settings') || 'Settings'}>
            <span className="text-lg">⚙️</span>
          </Button>
        </div>
      </div>
      {onToggleCollapse && (
        <div className="flex justify-start">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onToggleCollapse} 
            className="px-2 py-1 text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
          >
            <span className="text-sm mr-1">◀</span>
            <span>{t('sidebar.collapse') || 'Collapse sidebar'}</span>
          </Button>
        </div>
      )}
    </div>
  );
}

