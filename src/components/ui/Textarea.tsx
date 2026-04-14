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
                    "control-frame min-h-24 w-full px-4 py-3 text-sm leading-normal placeholder:text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--accent-main))] focus-visible:ring-offset-2 focus-visible:ring-offset-background hover:bg-card/92 disabled:bg-background/70 disabled:opacity-50 resize-y",
                    error && "border-[rgb(var(--color-error))]/70 focus-visible:ring-[rgb(var(--color-error))]/30",
                    className
                )}
                {...props}
            />
            {error && (
                <span className="text-xs font-medium text-[rgb(var(--color-error))]">{error}</span>
            )}
        </div>
    );
};
