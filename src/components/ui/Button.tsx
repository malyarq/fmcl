import React from 'react';
import { cn } from '../../utils/cn';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
    size?: 'sm' | 'md' | 'lg';
    isLoading?: boolean;
    progress?: number;
}

// Reusable button with variants and optional progress overlay.
export const Button: React.FC<ButtonProps> = ({
    className,
    variant = 'primary',
    size = 'md',
    isLoading,
    progress,
    children,
    disabled,
    ...props
}) => {
    const baseStyles = 'rounded-lg font-bold transition-all duration-300 ease-out transform active:scale-[0.98] hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-zinc-900 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 disabled:hover:scale-100 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl disabled:hover:shadow-lg';

    const variants = {
        primary: 'bg-zinc-800 text-white hover:bg-zinc-700 dark:bg-zinc-200 dark:text-black dark:hover:bg-zinc-300 shadow-zinc-900/20 dark:shadow-zinc-200/20',
        secondary: 'bg-white/80 dark:bg-zinc-800/80 backdrop-blur-sm text-zinc-900 hover:bg-white dark:text-zinc-100 dark:hover:bg-zinc-800 border border-zinc-300/50 dark:border-zinc-700/50 shadow-zinc-900/10 dark:shadow-black/20',
        danger: 'bg-red-500 text-white hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700 shadow-red-500/30 dark:shadow-red-600/30',
        ghost: 'bg-transparent text-zinc-600 hover:bg-zinc-100/80 dark:text-zinc-400 dark:hover:bg-zinc-800/50 shadow-none',
    };

    const sizes = {
        sm: 'px-3 py-1.5 text-xs',
        md: 'px-4 py-2 text-sm',
        lg: 'px-6 py-3 text-base',
    };

    return (
        <button
            className={cn(baseStyles, variants[variant], sizes[size], "relative overflow-hidden", className)}
            disabled={disabled || isLoading}
            {...props}
        >
            {typeof progress === 'number' && (
                <div
                    className="absolute inset-y-0 left-0 bg-black/10 dark:bg-white/10 transition-all duration-300 ease-linear"
                    style={{ width: `${progress}%` }}
                />
            )}

            <div className="relative z-10 flex items-center justify-center gap-2">
                {isLoading && (
                    <span className="w-4 h-4 border-2 border-inherit border-t-transparent rounded-full animate-spin" />
                )}
                {children}
            </div>
        </button>
    );
};
