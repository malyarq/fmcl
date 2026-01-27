import React from 'react';
import { cn } from '../../utils/cn';

export interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  variant?: 'primary' | 'secondary' | 'accent';
}

const sizeClasses = {
  sm: 'w-4 h-4 border-2',
  md: 'w-6 h-6 border-2',
  lg: 'w-8 h-8 border-3',
  xl: 'w-12 h-12 border-4',
};

const variantClasses = {
  primary: 'border-zinc-300 dark:border-zinc-600 border-t-zinc-900 dark:border-t-zinc-100',
  secondary: 'border-zinc-200 dark:border-zinc-700 border-t-zinc-600 dark:border-t-zinc-400',
  accent: 'border-zinc-300/30 dark:border-zinc-600/30 border-t-current',
};

/**
 * LoadingSpinner - компонент спиннера загрузки
 * 
 * @example
 * <LoadingSpinner size="md" />
 * <LoadingSpinner size="lg" variant="accent" className="text-blue-500" />
 */
export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  className,
  variant = 'primary',
}) => {
  return (
    <div
      className={cn(
        'rounded-full animate-spin',
        sizeClasses[size],
        variantClasses[variant],
        className
      )}
      role="status"
      aria-label="Loading"
    >
      <span className="sr-only">Loading...</span>
    </div>
  );
};
