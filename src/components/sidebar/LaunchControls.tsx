import type { CSSProperties } from 'react';
import React, { useMemo } from 'react';
import { Button } from '../ui/Button';
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
}) {
  const { isLaunching, progress, statusText, onLaunch, t, getAccentHex, getAccentStyles, isCollapsed } = props;

  // Memoize accent style to prevent recalculation
  const accentStyle = useMemo(() => getAccentStyles('bg').style || {}, [getAccentStyles]);
  const accentHex = useMemo(() => getAccentHex(), [getAccentHex]);

  if (isCollapsed) {
    return (
      <div className="mt-auto pb-2">
        <Button
          onClick={onLaunch}
          disabled={isLaunching}
          data-tour="launch"
          className={cn(
            'w-12 h-12 p-0 rounded-full shadow-2xl transition-all duration-300 ease-out transform',
            isLaunching
              ? 'bg-zinc-300 dark:bg-zinc-600 text-zinc-500 dark:text-zinc-400 cursor-not-allowed shadow-none scale-100'
              : cn(
                  'text-white hover:brightness-110 active:scale-[0.97] hover:scale-[1.03]',
                  'hover:shadow-[0_0_40px_rgba(0,0,0,0.4)]',
                  getAccentStyles('bg').className
                )
          )}
          style={
            !isLaunching
              ? {
                  ...accentStyle,
                  boxShadow: `0 12px 40px ${accentHex}50, 0 0 30px ${accentHex}30`,
                }
              : {}
          }
          progress={isLaunching ? progress : undefined}
          title={isLaunching ? t('general.running') : t('general.play')}
        >
          <span className="text-xl">▶</span>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 mt-8 pb-4 pt-6 border-t border-zinc-300/50 dark:border-zinc-700/50">
      <div className="text-center text-xs font-medium text-zinc-500 dark:text-zinc-400 min-h-[1.25rem]">
        {statusText && (
          <span className="animate-pulse">{statusText}</span>
        )}
      </div>

      <div className="flex gap-2">
        <Button
          onClick={onLaunch}
          disabled={isLaunching}
          data-tour="launch"
          className={cn(
            'flex-1 py-5 text-lg font-black uppercase tracking-widest shadow-2xl transition-all duration-300 ease-out transform',
            isLaunching
              ? 'bg-zinc-300 dark:bg-zinc-600 text-zinc-500 dark:text-zinc-400 cursor-not-allowed shadow-none scale-100'
              : cn(
                  'text-white hover:brightness-110 active:scale-[0.97] hover:scale-[1.03]',
                  'hover:shadow-[0_0_40px_rgba(0,0,0,0.4)]',
                  getAccentStyles('bg').className
                )
          )}
          style={
            !isLaunching
              ? {
                  ...accentStyle,
                  boxShadow: `0 12px 40px ${accentHex}50, 0 0 30px ${accentHex}30`,
                }
              : {}
          }
          progress={isLaunching ? progress : undefined}
        >
          <span className="text-2xl mr-2">▶</span>
          {isLaunching ? t('general.running') : t('general.play')}
        </Button>

        {/* Force restart button - only shown during launch */}
        {isLaunching && (
          <Button variant="danger" onClick={() => window.location.reload()} className="px-3" title="Force Restart">
            ✕
          </Button>
        )}
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function for React.memo
  return (
    prevProps.isLaunching === nextProps.isLaunching &&
    prevProps.progress === nextProps.progress &&
    prevProps.statusText === nextProps.statusText &&
    prevProps.isCollapsed === nextProps.isCollapsed
  );
});

