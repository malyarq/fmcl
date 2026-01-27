import React from 'react';
import { useSettings } from '../../contexts/SettingsContext';
import { cn } from '../../utils/cn';

export interface ProgressBarProps {
  /** Progress value from 0 to 100 */
  value: number;
  /** Optional label shown on the left */
  label?: string;
  /** Optional value shown on the right (e.g., "50%", "1.5 MB / 10 MB") */
  valueLabel?: string;
  /** Height of the progress bar */
  height?: 'sm' | 'md' | 'lg';
  /** Show animated shimmer effect */
  animated?: boolean;
  /** Custom className */
  className?: string;
  /** Show percentage inside the bar */
  showPercentage?: boolean;
}

/**
 * Universal progress bar component with consistent styling
 */
export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  label,
  valueLabel,
  height = 'md',
  animated = true,
  className,
  showPercentage = false,
}) => {
  const { getAccentStyles } = useSettings();

  const heightClasses = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3',
  };

  const clampedValue = Math.max(0, Math.min(100, value));

  return (
    <div className={cn('space-y-2', className)}>
      {(label || valueLabel) && (
        <div className="flex justify-between text-xs text-zinc-600 dark:text-zinc-400">
          {label && <span>{label}</span>}
          {valueLabel && <span>{valueLabel}</span>}
        </div>
      )}
      <div className={cn(
        'w-full bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden relative',
        heightClasses[height]
      )}>
        <div
          className={cn(
            'h-full transition-all duration-300 ease-out',
            animated && 'relative',
            getAccentStyles('bg').className
          )}
          style={{
            ...getAccentStyles('bg').style,
            width: `${clampedValue}%`,
          }}
        >
          {animated && (
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
          )}
        </div>
        {showPercentage && clampedValue > 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-zinc-900 dark:text-white">
            {Math.round(clampedValue)}%
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Helper function to format bytes for progress labels
 */
// eslint-disable-next-line react-refresh/only-export-components
export const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
};
