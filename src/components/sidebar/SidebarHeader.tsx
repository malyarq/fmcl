import type { CSSProperties } from 'react';
import { Globe2, LayoutGrid, Menu, PanelLeftClose, PanelsTopLeft, Settings2 } from 'lucide-react';
import { BrandWordmark } from '../branding/BrandWordmark';
import { Button } from '../ui/Button';
import { cn } from '../../utils/cn';
import type { UIMode } from '../../contexts/settings/types';
import { SIDEBAR_COMPACT_CONTROL_CLASSNAME } from './controlGeometry';

export function SidebarHeader(props: {
  appVersion: string;
  onShowMultiplayer: () => void;
  onShowSettings: () => void;
  getAccentStyles: (type: 'text') => { className?: string; style?: CSSProperties };
  getAccentHex: () => string;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  contentId?: string;
  t: (key: string) => string;
  uiMode: UIMode;
  onChangeMode: (mode: UIMode) => void;
}) {
  const {
    appVersion,
    onShowMultiplayer,
    onShowSettings,
    isCollapsed,
    onToggleCollapse,
    contentId,
    t,
    uiMode,
    onChangeMode,
  } = props;
  const simpleLabel = t('ui_mode.simple') || 'Classic';
  const modpacksLabel = t('ui_mode.modpacks') || 'Modpacks';
  const currentModeLabel = uiMode === 'simple' ? simpleLabel : modpacksLabel;

  return (
    <div className={cn("relative mb-3", isCollapsed && "mb-2")}>
      {onToggleCollapse && isCollapsed && (
        <Button
          variant="ghost"
          size="sm"
          geometry="compact-control"
          onClick={onToggleCollapse}
          aria-label={t('sidebar.expand') || 'Expand sidebar'}
          aria-controls={contentId}
          aria-expanded={!isCollapsed}
          data-testid="sidebar-expand-button"
          className={cn('mx-auto block', SIDEBAR_COMPACT_CONTROL_CLASSNAME)}
          style={{
            transition: 'opacity 300ms ease-out, transform 300ms ease-out',
            transform: 'scale(1)',
          }}
        >
          <Menu className="h-5 w-5" />
        </Button>
      )}

      {/* Header content - скрывается при сворачивании */}
      <div className={cn(
        "transition-all duration-300 ease-out",
        isCollapsed ? "opacity-0 h-0 overflow-hidden" : "opacity-100"
      )}>
        <div className="mb-2 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-1.5">
            <BrandWordmark
              as="p"
              tone="default"
              data-testid="sidebar-app-title"
              className="text-[15px] leading-none text-foreground sm:text-base"
            />
            <p className="text-[11px] leading-4 text-secondary">
              {currentModeLabel} • v{appVersion}
            </p>
          </div>
          <div className={cn(
            "flex shrink-0 gap-1 transition-all duration-500 ease-out",
            isCollapsed 
              ? "opacity-0 pointer-events-none scale-95" 
              : "opacity-100 pointer-events-auto scale-100"
          )}>
            <Button 
              variant="ghost" 
              size="sm" 
              data-tour="multiplayer"
              onClick={onShowMultiplayer} 
              className="h-8 w-8 px-0 transition-all duration-500 ease-out"
              title={t('multiplayer.title') || 'Multiplayer'}
            >
              <Globe2 className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              data-tour="settings"
              onClick={onShowSettings} 
              className="h-8 w-8 px-0 transition-all duration-500 ease-out"
              title={t('general.settings') || 'Settings'}
            >
              <Settings2 className="h-4 w-4" />
            </Button>
            {onToggleCollapse && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onToggleCollapse}
                aria-label={t('sidebar.collapse') || 'Collapse sidebar'}
                aria-controls={contentId}
                aria-expanded={!isCollapsed}
                className="h-8 w-8 px-0 transition-all duration-500 ease-out"
                title={t('sidebar.collapse') || 'Collapse sidebar'}
              >
                <PanelLeftClose className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Mode switcher - трансформируется */}
      <div className={cn(
        'mt-3 rounded-[18px] border border-border/60 bg-background/84 shadow-inner transition-all duration-500 ease-out',
        isCollapsed 
          ? "flex w-full flex-col gap-1 p-1"
          : "flex w-full p-1"
      )} data-testid="sidebar-mode-switcher">
        <button
          type="button"
          data-tour="classic"
          onClick={() => onChangeMode('simple')}
          aria-label={isCollapsed ? simpleLabel : undefined}
          aria-pressed={uiMode === 'simple'}
          className={cn(
            'flex items-center justify-center font-medium transition-all duration-500 ease-out',
            isCollapsed 
              ? 'min-h-10 rounded-2xl px-2 py-1.5 flex-none'
              : 'flex-1 rounded-full px-3 py-1',
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
            'flex items-center justify-center font-medium transition-all duration-500 ease-out',
            isCollapsed 
              ? 'min-h-10 rounded-2xl px-2 py-1.5 flex-none'
              : 'flex-1 rounded-full px-3 py-1',
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
