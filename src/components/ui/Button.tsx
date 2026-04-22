import React from 'react';
import { cn } from '../../utils/cn';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
    size?: 'sm' | 'md' | 'lg';
    geometry?: 'default' | 'catalog-primary' | 'compact-control' | 'utility';
    isLoading?: boolean;
    progress?: number;
}

// Reusable button with variants and optional progress overlay.
export const Button: React.FC<ButtonProps> = ({
    className,
    variant = 'primary',
    size = 'md',
    geometry = 'default',
    isLoading,
    progress,
    children,
    disabled,
    ...props
}) => {
    const isBusy = Boolean(isLoading);
    const baseStyles =
        'motion-safe-transform flex min-w-0 items-center justify-center gap-2 rounded-xl border font-semibold leading-none shadow-[0_10px_28px_rgba(0,0,0,0.12)] hover:shadow-[0_14px_34px_rgba(0,0,0,0.16)] disabled:hover:shadow-none motion-safe:transform motion-safe:transition-all motion-safe:duration-300 motion-safe:ease-out motion-safe:active:scale-[0.98] motion-safe:hover:scale-[1.01] focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--accent-main))] focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-100 disabled:shadow-none disabled:active:scale-100 disabled:hover:scale-100';

    const variants = {
        primary:
            'border-[rgb(var(--accent-main)/0.28)] bg-[rgb(var(--accent-main))] text-[rgb(var(--accent-content))] hover:border-[rgb(var(--accent-hover)/0.34)] hover:bg-[rgb(var(--accent-hover))] active:bg-[rgb(var(--accent-hover))] disabled:border-border/60 disabled:bg-background/72 disabled:text-muted',
        secondary:
            'border-border/70 bg-card/82 text-foreground hover:border-[rgb(var(--accent-main)/0.18)] hover:bg-card/96 hover:text-foreground backdrop-blur-md disabled:border-border/60 disabled:bg-background/72 disabled:text-muted',
        danger:
            'border-red-500/20 bg-red-500 text-white hover:border-red-500/40 hover:bg-red-600 shadow-[0_10px_28px_rgba(239,68,68,0.24)] hover:shadow-[0_14px_34px_rgba(239,68,68,0.28)] disabled:border-border/60 disabled:bg-background/72 disabled:text-muted',
        ghost:
            'border-transparent bg-transparent text-secondary hover:border-[rgb(var(--accent-main)/0.18)] hover:bg-card/72 hover:text-foreground shadow-none hover:shadow-none disabled:text-muted',
    };

    const sizes = {
        sm: 'min-h-9 px-3.5 text-sm',
        md: 'min-h-11 px-4 text-sm',
        lg: 'min-h-[3.25rem] px-5 text-base',
    };

    const geometries = {
        default: '',
        'catalog-primary': 'min-h-10 px-4 text-sm leading-tight whitespace-normal [&_svg]:h-4 [&_svg]:w-4',
        'compact-control': 'h-12 w-12 rounded-2xl p-0 [&_svg]:h-5 [&_svg]:w-5',
        utility:
            'max-w-full whitespace-normal px-4 py-2.5 text-center leading-tight [&_svg]:h-4 [&_svg]:w-4 [&>div]:min-w-0 [&>div]:w-full [&>div]:flex-wrap [&>div]:justify-center',
    };

    return (
        <button
            className={cn(baseStyles, variants[variant], sizes[size], geometries[geometry], "relative overflow-hidden", className)}
            disabled={disabled || isLoading}
            aria-busy={isBusy || undefined}
            data-variant={variant}
            data-button-geometry={geometry !== 'default' ? geometry : undefined}
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
