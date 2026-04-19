import React, { useId } from 'react';
import { cn } from '../../utils/cn';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
    label?: string;
    error?: string;
    containerClassName?: string;
}

// Labeled textarea with optional error message.
export const Textarea: React.FC<TextareaProps> = ({
    className,
    containerClassName,
    label,
    error,
    ...props
}) => {
    const generatedId = useId();
    const textareaId = props.id ?? generatedId;

    return (
        <div className={cn("flex flex-col gap-1.5 w-full", containerClassName)}>
            {label && (
                <label htmlFor={textareaId} className="control-label">
                    {label}
                </label>
            )}
            <textarea
                id={textareaId}
                className={cn(
                    "control-frame min-h-24 w-full resize-y px-4 py-3 text-sm leading-normal placeholder:text-muted/90 focus:border-[rgb(var(--accent-main)/0.36)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--accent-main))] focus-visible:ring-offset-2 focus-visible:ring-offset-background hover:border-border hover:bg-card/92 disabled:cursor-not-allowed disabled:border-border/50 disabled:bg-background/72 disabled:text-muted disabled:placeholder:text-muted/80 disabled:opacity-100",
                    error && "border-[rgb(var(--color-error))]/70 focus:border-[rgb(var(--color-error))]/80 focus-visible:ring-[rgb(var(--color-error))]/30",
                    className
                )}
                aria-invalid={error ? true : undefined}
                {...props}
            />
            {error && (
                <span className="text-xs font-medium text-[rgb(var(--color-error))]">{error}</span>
            )}
        </div>
    );
};
