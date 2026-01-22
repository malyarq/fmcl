import React from 'react';
import { cn } from '../../utils/cn';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
    size?: 'sm' | 'md' | 'lg';
    isLoading?: boolean;
    progress?: number;
}

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
    const baseStyles = 'rounded font-bold transition-all transform active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-1 dark:focus:ring-offset-zinc-900 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 flex items-center justify-center gap-2';

    const variants = {
        primary: 'bg-zinc-800 text-white hover:bg-zinc-700 dark:bg-zinc-200 dark:text-black dark:hover:bg-zinc-300',
        secondary: 'bg-zinc-200 text-zinc-900 hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700',
        danger: 'bg-red-500 text-white hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700',
        ghost: 'bg-transparent text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800/50',
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
            {/* Progress Bar Background */}
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
