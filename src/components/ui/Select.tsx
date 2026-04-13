import React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../utils/cn';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
    label?: string;
    description?: string;
    error?: string;
}

// Labeled select with optional description and error text.
export const Select: React.FC<SelectProps> = ({
    label,
    description,
    error,
    className,
    children,
    ...props
}) => {
    return (
        <div className={cn("flex flex-col gap-1.5", className?.match(/\bw-/) ? undefined : "w-full", className)}>
            {label && (
                <label className="text-xs font-medium uppercase tracking-wider text-secondary">
                    {label}
                </label>
            )}
            <div className="relative w-full min-w-0">
                <select
                    className={cn(
                        'w-full appearance-none rounded-xl border border-border/70 bg-card/82 pl-3 pr-8 py-3 text-sm leading-normal text-foreground shadow-[0_8px_24px_rgba(0,0,0,0.08)] backdrop-blur-md transition-all hover:bg-card/92',
                        'focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--accent-main))] focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                        'disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none',
                        error && 'border-red-500 focus-visible:ring-red-500/30'
                    )}
                    {...props}
                >
                    {children}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted">
                    <ChevronDown className="h-4 w-4 shrink-0" />
                </div>
            </div>
            {description && (
                <p className="text-xs text-muted">{description}</p>
            )}
            {error && (
                <p className="text-xs text-red-500 font-medium">{error}</p>
            )}
        </div>
    );
};
