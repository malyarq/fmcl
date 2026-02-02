import type { CSSProperties } from 'react';
import { Button } from '../ui/Button';
import { cn } from '../../utils/cn';
import type { UIMode } from '../../contexts/settings/types';

export function SidebarHeader(props: {
  appVersion: string;
  onShowMultiplayer: () => void;
  onShowSettings: () => void;
  getAccentStyles: (type: 'text') => { className?: string; style?: CSSProperties };
  getAccentHex: () => string;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  t: (key: string) => string;
  uiMode: UIMode;
  onChangeMode: (mode: UIMode) => void;
}) {
  const {
    appVersion,
    onShowMultiplayer,
    onShowSettings,
    getAccentStyles,
    getAccentHex,
    isCollapsed,
    onToggleCollapse,
    t,
    uiMode,
    onChangeMode,
  } = props;

  return (
    <div className={cn("relative mb-3", isCollapsed && "mb-2")}>
      {/* Burger button - всегда рендерится, но меняет позицию */}
      {onToggleCollapse && (
        <button 
          onClick={onToggleCollapse} 
          className={cn(
            "px-2 py-1 text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-100/50 dark:hover:bg-zinc-800/50 rounded transition-all duration-300 ease-out",
            isCollapsed 
              ? "mx-auto block" 
              : "absolute top-0 right-0 opacity-0 pointer-events-none"
          )}
          style={{
            transition: 'opacity 300ms ease-out, transform 300ms ease-out',
            transform: isCollapsed ? 'scale(1)' : 'scale(0.8)',
          }}
        >
          <span className="text-lg">☰</span>
        </button>
      )}

      {/* Header content - скрывается при сворачивании */}
      <div className={cn(
        "transition-all duration-300 ease-out",
        isCollapsed ? "opacity-0 h-0 overflow-hidden" : "opacity-100"
      )}>
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
          <div className={cn(
            "flex gap-1 transition-all duration-500 ease-out",
            isCollapsed 
              ? "opacity-0 pointer-events-none scale-95" 
              : "opacity-100 pointer-events-auto scale-100"
          )}>
            <Button 
              variant="ghost" 
              size="sm" 
              data-tour="multiplayer"
              onClick={onShowMultiplayer} 
              className="px-2 transition-all duration-500 ease-out" 
              title={t('multiplayer.title') || 'Multiplayer'}
            >
              <span className="text-lg">🌐</span>
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              data-tour="settings"
              onClick={onShowSettings} 
              className="px-2 transition-all duration-500 ease-out" 
              title={t('general.settings') || 'Settings'}
            >
              <span className="text-lg">⚙️</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Mode switcher - трансформируется */}
      <div className={cn(
        "mt-3 rounded-full bg-zinc-200/60 dark:bg-zinc-800/80 shadow-inner transition-all duration-500 ease-out",
        isCollapsed 
          ? "flex flex-col w-full gap-0.5 p-0.5" 
          : "flex w-full p-1"
      )}>
        <button
          type="button"
          data-tour="classic"
          onClick={() => onChangeMode('simple')}
          className={cn(
            'flex items-center justify-center font-medium rounded-full transition-all duration-500 ease-out',
            isCollapsed 
              ? 'px-2 py-1.5 flex-none' 
              : 'flex-1 px-3 py-1',
            uiMode === 'simple'
              ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-900 dark:text-white'
              : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
          )}
          title={isCollapsed ? (t('ui_mode.simple') || 'Classic') : undefined}
        >
          <span className={cn(
            "transition-all duration-500 ease-out inline-block",
            isCollapsed ? "text-[9px] opacity-100" : "text-[11px] opacity-100"
          )}>
            {isCollapsed ? (t('ui_mode.simple')?.charAt(0) || 'C') : t('ui_mode.simple') || 'Classic'}
          </span>
        </button>
        <button
          type="button"
          data-tour="modpacks"
          onClick={() => onChangeMode('modpacks')}
          className={cn(
            'flex items-center justify-center font-medium rounded-full transition-all duration-500 ease-out',
            isCollapsed 
              ? 'px-2 py-1.5 flex-none' 
              : 'flex-1 px-3 py-1',
            uiMode === 'modpacks'
              ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-900 dark:text-white'
              : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
          )}
          title={isCollapsed ? (t('ui_mode.modpacks') || 'Modpacks') : undefined}
        >
          <span className={cn(
            "transition-all duration-500 ease-out inline-block",
            isCollapsed ? "text-[9px] opacity-100" : "text-[11px] opacity-100"
          )}>
            {isCollapsed ? 'M' : t('ui_mode.modpacks') || 'Modpacks'}
          </span>
        </button>
      </div>
    </div>
  );
}

