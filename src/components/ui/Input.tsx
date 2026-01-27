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
                <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                    {label}
                </label>
            )}
            <input
                className={cn(
                    "w-full bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm border border-zinc-300/50 dark:border-zinc-700/50 rounded-lg px-3 py-3 text-sm leading-normal focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-600 focus:border-transparent transition-all shadow-sm hover:shadow-md placeholder-zinc-400 dark:placeholder-zinc-600 text-zinc-900 dark:text-zinc-100 disabled:opacity-50 disabled:bg-zinc-100 dark:disabled:bg-zinc-800",
                    error && "border-red-500 focus:ring-red-500 dark:border-red-500",
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
