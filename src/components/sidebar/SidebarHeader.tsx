import type { CSSProperties } from 'react';
import { Globe2, LayoutGrid, Menu, PanelsTopLeft, Settings2 } from 'lucide-react';
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
  const simpleLabel = t('ui_mode.simple') || 'Classic';
  const modpacksLabel = t('ui_mode.modpacks') || 'Modpacks';

  return (
    <div className={cn("relative mb-3", isCollapsed && "mb-2")}>
      {/* Burger button - всегда рендерится, но меняет позицию */}
      {onToggleCollapse && (
        <button 
          onClick={onToggleCollapse} 
          aria-label={t('sidebar.expand') || 'Expand sidebar'}
          className={cn(
            'mx-auto flex h-9 w-9 items-center justify-center rounded-xl border border-border/60 bg-card/78 text-secondary transition-all duration-300 ease-out hover:bg-card/96 hover:text-foreground',
            isCollapsed 
              ? "mx-auto block" 
              : "absolute top-0 right-0 opacity-0 pointer-events-none"
          )}
          style={{
            transition: 'opacity 300ms ease-out, transform 300ms ease-out',
            transform: isCollapsed ? 'scale(1)' : 'scale(0.8)',
          }}
        >
          <Menu className="h-4 w-4" />
        </button>
      )}

      {/* Header content - скрывается при сворачивании */}
      <div className={cn(
        "transition-all duration-300 ease-out",
        isCollapsed ? "opacity-0 h-0 overflow-hidden" : "opacity-100"
      )}>
        <div className="mb-2 flex items-start justify-between">
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
            <p className="mt-1 font-mono text-[10px] text-muted opacity-70">BUILD v{appVersion}</p>
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
              <Globe2 className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              data-tour="settings"
              onClick={onShowSettings} 
              className="px-2 transition-all duration-500 ease-out" 
              title={t('general.settings') || 'Settings'}
            >
              <Settings2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Mode switcher - трансформируется */}
      <div className={cn(
        'mt-3 rounded-[20px] border border-border/60 bg-background/84 shadow-inner transition-all duration-500 ease-out',
        isCollapsed 
          ? "flex flex-col w-full gap-0.5 p-0.5" 
          : "flex w-full p-1"
      )}>
        <button
          type="button"
          data-tour="classic"
          onClick={() => onChangeMode('simple')}
          aria-label={isCollapsed ? simpleLabel : undefined}
          aria-pressed={uiMode === 'simple'}
          className={cn(
            'flex items-center justify-center font-medium rounded-full transition-all duration-500 ease-out',
            isCollapsed 
              ? 'px-2 py-1.5 flex-none' 
              : 'flex-1 px-3 py-1',
            uiMode === 'simple'
              ? 'bg-card text-foreground shadow-sm'
              : 'text-secondary hover:text-foreground'
          )}
          title={isCollapsed ? simpleLabel : undefined}
        >
          {isCollapsed ? (
            <PanelsTopLeft className="h-3.5 w-3.5" data-testid="sidebar-mode-simple-glyph" aria-hidden="true" />
          ) : (
            <span className="inline-block text-[11px] transition-all duration-500 ease-out">
              {simpleLabel}
            </span>
          )}
        </button>
        <button
          type="button"
          data-tour="modpacks"
          onClick={() => onChangeMode('modpacks')}
          aria-label={isCollapsed ? modpacksLabel : undefined}
          aria-pressed={uiMode === 'modpacks'}
          className={cn(
            'flex items-center justify-center font-medium rounded-full transition-all duration-500 ease-out',
            isCollapsed 
              ? 'px-2 py-1.5 flex-none' 
              : 'flex-1 px-3 py-1',
            uiMode === 'modpacks'
              ? 'bg-card text-foreground shadow-sm'
              : 'text-secondary hover:text-foreground'
          )}
          title={isCollapsed ? modpacksLabel : undefined}
        >
          {isCollapsed ? (
            <LayoutGrid className="h-3.5 w-3.5" data-testid="sidebar-mode-modpacks-glyph" aria-hidden="true" />
          ) : (
            <span
              className={cn(
                'transition-all duration-500 ease-out inline-block text-[11px] opacity-100',
              )}
            >
              {modpacksLabel}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
