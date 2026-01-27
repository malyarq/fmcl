import React from 'react';
import { cn } from '../../utils/cn';

export interface ErrorMessageProps {
    message: string;
    className?: string;
    variant?: 'default' | 'inline';
}

/**
 * Reusable error message component for forms and UI.
 * Supports both standalone and inline variants.
 */
export const ErrorMessage: React.FC<ErrorMessageProps> = ({
    message,
    className,
    variant = 'default',
}) => {
    if (variant === 'inline') {
        return (
            <span className={cn('text-xs text-red-500 dark:text-red-400 font-medium', className)}>
                {message}
            </span>
        );
    }

    return (
        <div
            className={cn(
                'flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50',
                className
            )}
            role="alert"
            aria-live="polite"
        >
            <span className="text-red-500 dark:text-red-400 font-bold flex-shrink-0">✕</span>
            <p className="text-sm text-red-700 dark:text-red-300 font-medium">{message}</p>
        </div>
    );
};
