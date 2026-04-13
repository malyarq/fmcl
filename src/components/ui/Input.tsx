import React from 'react';
import { cn } from '../../utils/cn';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    containerClassName?: string;
}

// Labeled input with optional error message.
export const Input: React.FC<InputProps> = ({
    className,
    containerClassName,
    label,
    error,
    ...props
}) => {
    return (
        <div className={cn("flex flex-col gap-1.5 w-full", containerClassName)}>
            {label && (
                <label className="text-xs font-medium uppercase tracking-wider text-secondary">
                    {label}
                </label>
            )}
            <input
                className={cn(
                    'w-full rounded-xl border border-border/70 bg-card/82 px-3 py-3 text-sm leading-normal text-foreground shadow-[0_8px_24px_rgba(0,0,0,0.08)] backdrop-blur-md transition-all placeholder:text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--accent-main))] focus-visible:ring-offset-2 focus-visible:ring-offset-background hover:bg-card/92 disabled:opacity-50 disabled:bg-background/70',
                    error && 'border-red-500 focus-visible:ring-red-500/30',
                    className
                )}
                {...props}
            />
            {error && (
                <span className="text-xs text-red-500 font-medium">{error}</span>
            )}
        </div>
    );
};
