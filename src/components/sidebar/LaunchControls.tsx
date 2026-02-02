import type { CSSProperties } from 'react';
import React, { useMemo } from 'react';
import { Button } from '../ui/Button';
import { launcherIPC } from '../../services/ipc/launcherIPC';
import { cn } from '../../utils/cn';

export const LaunchControls = React.memo(function LaunchControls(props: {
  isLaunching: boolean;
  progress: number;
  statusText: string;
  onLaunch: () => void;
  t: (key: string) => string;
  getAccentHex: () => string;
  getAccentStyles: (type: 'bg') => { className?: string; style?: CSSProperties };
  isCollapsed?: boolean;
  canLaunch?: boolean;
  lastLaunch?: string;
}) {
  const { isLaunching, progress, statusText, onLaunch, t, getAccentHex, getAccentStyles, isCollapsed, canLaunch = true, lastLaunch } = props;

  // Memoize accent style to prevent recalculation
  const accentStyle = useMemo(() => getAccentStyles('bg').style || {}, [getAccentStyles]);
  const accentHex = useMemo(() => getAccentHex(), [getAccentHex]);

  return (
    <div className={cn(
      "transition-all duration-300 ease-out",
      isCollapsed ? "mt-auto pb-2" : "space-y-4 mt-8 pb-4 pt-6"
    )}>
      {!isCollapsed && (
        <div className="text-center text-xs font-medium text-zinc-500 dark:text-zinc-400 min-h-[1.25rem]">
          {statusText ? (
            <span className="animate-pulse">{statusText}</span>
          ) : lastLaunch ? (
            <span>{t('dashboard.last_launch') || 'Last launch'}: {lastLaunch}</span>
          ) : null}
        </div>
      )}

      <div className={cn("flex gap-2", isCollapsed && "justify-center")}>
        <Button
          onClick={onLaunch}
          disabled={isLaunching || !canLaunch}
          data-tour="launch"
          className={cn(
            'text-lg font-black uppercase tracking-widest shadow-2xl transform !transition-none',
            // Плавная анимация изменения формы - переопределяем rounded-lg из Button
            isCollapsed 
              ? 'w-12 h-12 p-0 flex-none [&>div]:gap-0 [&>div]:justify-center' 
              : 'flex-1 py-5',
            isLaunching || !canLaunch
              ? 'bg-zinc-300 dark:bg-zinc-600 text-zinc-500 dark:text-zinc-400 cursor-not-allowed shadow-none scale-100'
              : cn(
                  'text-white hover:brightness-110 active:scale-[0.97] hover:scale-[1.03]',
                  'hover:shadow-[0_0_40px_rgba(0,0,0,0.4)]',
                  getAccentStyles('bg').className
                )
          )}
          style={
            !isLaunching && canLaunch
              ? {
                  ...accentStyle,
                  boxShadow: `0 12px 40px ${accentHex}50, 0 0 30px ${accentHex}30`,
                  borderRadius: isCollapsed ? '9999px' : '0.5rem',
                  transition: isCollapsed 
                    ? 'width 500ms cubic-bezier(0.25, 0.46, 0.45, 0.94), height 500ms cubic-bezier(0.25, 0.46, 0.45, 0.94), padding 500ms cubic-bezier(0.25, 0.46, 0.45, 0.94), border-radius 800ms cubic-bezier(0.25, 0.46, 0.45, 0.94), transform 200ms ease-out, box-shadow 500ms cubic-bezier(0.25, 0.46, 0.45, 0.94)'
                    : 'width 600ms cubic-bezier(0.34, 1.56, 0.64, 1), height 600ms cubic-bezier(0.34, 1.56, 0.64, 1), padding 600ms cubic-bezier(0.34, 1.56, 0.64, 1), border-radius 700ms cubic-bezier(0.34, 1.56, 0.64, 1), transform 200ms ease-out, box-shadow 600ms cubic-bezier(0.34, 1.56, 0.64, 1)',
                  willChange: 'border-radius, width, height, padding',
                }
              : {
                  borderRadius: isCollapsed ? '9999px' : '0.5rem',
                  transition: isCollapsed
                    ? 'width 500ms cubic-bezier(0.25, 0.46, 0.45, 0.94), height 500ms cubic-bezier(0.25, 0.46, 0.45, 0.94), padding 500ms cubic-bezier(0.25, 0.46, 0.45, 0.94), border-radius 800ms cubic-bezier(0.25, 0.46, 0.45, 0.94)'
                    : 'width 600ms cubic-bezier(0.34, 1.56, 0.64, 1), height 600ms cubic-bezier(0.34, 1.56, 0.64, 1), padding 600ms cubic-bezier(0.34, 1.56, 0.64, 1), border-radius 700ms cubic-bezier(0.34, 1.56, 0.64, 1)',
                  willChange: 'border-radius, width, height, padding',
                }
          }
          progress={isLaunching ? progress : undefined}
          title={isCollapsed ? (isLaunching ? t('general.running') : t('general.play')) : undefined}
        >
          <span className={cn(
            'transition-all duration-500 ease-out',
            isCollapsed ? 'text-xl ml-1' : 'text-2xl mr-2'
          )}>▶</span>
          <span className={cn(
            "transition-all duration-500 ease-out inline-block overflow-hidden",
            isCollapsed 
              ? "w-0 opacity-0 mr-0 hidden" 
              : "w-auto opacity-100"
          )}>
            {isLaunching ? t('general.running') : t('general.play')}
          </span>
        </Button>

        {/* Force restart button - only shown during launch: kills game process + reloads launcher */}
        {isLaunching && !isCollapsed && (
          <Button
            variant="danger"
            onClick={() => {
              if (launcherIPC.has('killAndRestart')) launcherIPC.killAndRestart();
              else window.location.reload();
            }}
            className="px-3"
            title="Force Restart"
          >
            ✕
          </Button>
        )}
      </div>
    </div>
  );
});

