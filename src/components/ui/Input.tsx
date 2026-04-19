import React, { useId } from 'react';
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
    const generatedId = useId();
    const inputId = props.id ?? generatedId;

    return (
        <div className={cn("flex flex-col gap-1.5 w-full", containerClassName)}>
            {label && (
                <label htmlFor={inputId} className="control-label">
                    {label}
                </label>
            )}
            <input
                id={inputId}
                className={cn(
                    'control-frame min-h-11 w-full px-4 py-2.5 text-sm leading-normal placeholder:text-muted/90 focus:border-[rgb(var(--accent-main)/0.36)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--accent-main))] focus-visible:ring-offset-2 focus-visible:ring-offset-background hover:border-border hover:bg-card/92 disabled:cursor-not-allowed disabled:border-border/50 disabled:bg-background/72 disabled:text-muted disabled:placeholder:text-muted/80 disabled:opacity-100',
                    error && 'border-red-500 focus:border-red-500 focus-visible:ring-red-500/30',
                    className
                )}
                aria-invalid={error ? true : undefined}
                {...props}
            />
            {error && (
                <span className="text-xs text-red-500 font-medium">{error}</span>
            )}
        </div>
    );
};
