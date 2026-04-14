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
    const isBusy = Boolean(isLoading);
    const baseStyles =
        'motion-safe-transform flex min-w-0 items-center justify-center gap-2 rounded-xl border font-semibold leading-none shadow-[0_10px_28px_rgba(0,0,0,0.12)] hover:shadow-[0_14px_34px_rgba(0,0,0,0.16)] disabled:hover:shadow-[0_10px_28px_rgba(0,0,0,0.12)] motion-safe:transform motion-safe:transition-all motion-safe:duration-300 motion-safe:ease-out motion-safe:active:scale-[0.98] motion-safe:hover:scale-[1.01] focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--accent-main))] focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100 disabled:hover:scale-100';

    const variants = {
        primary:
            'border-transparent bg-[rgb(var(--accent-main))] text-[rgb(var(--accent-content))] hover:bg-[rgb(var(--accent-hover))]',
        secondary:
            'border-border/70 bg-card/82 text-foreground hover:bg-card/96 backdrop-blur-md',
        danger:
            'border-red-500/20 bg-red-500 text-white hover:bg-red-600 shadow-[0_10px_28px_rgba(239,68,68,0.24)] hover:shadow-[0_14px_34px_rgba(239,68,68,0.28)]',
        ghost:
            'border-transparent bg-transparent text-secondary hover:bg-card/72 hover:text-foreground shadow-none hover:shadow-none',
    };

    const sizes = {
        sm: 'min-h-9 px-3.5 text-sm',
        md: 'min-h-11 px-4 text-sm',
        lg: 'min-h-[3.25rem] px-5 text-base',
    };

    return (
        <button
            className={cn(baseStyles, variants[variant], sizes[size], "relative overflow-hidden", className)}
            disabled={disabled || isLoading}
            aria-busy={isBusy || undefined}
            type={props.type ?? 'button'}
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
