import React, { useId } from 'react';
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
    const generatedId = useId();
    const selectId = props.id ?? generatedId;

    return (
        <div className={cn("flex flex-col gap-1.5", className?.match(/\bw-/) ? undefined : "w-full", className)}>
            {label && (
                <label htmlFor={selectId} className="control-label">
                    {label}
                </label>
            )}
            <div className="relative w-full min-w-0">
                <select
                    id={selectId}
                    className={cn(
                        'control-frame min-h-11 w-full appearance-none py-2.5 pl-4 pr-9 text-sm leading-normal hover:bg-card/92',
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
