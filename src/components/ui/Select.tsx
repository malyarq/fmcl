import React from 'react';
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
                <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                    {label}
                </label>
            )}
            <div className="relative w-full min-w-0">
                <select
                    className={cn(
                        "w-full bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm border border-zinc-300/50 dark:border-zinc-700/50 rounded-lg pl-3 pr-8 py-3 text-sm leading-normal",
                        "focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-600 focus:border-transparent",
                        "appearance-none cursor-pointer transition-all shadow-sm hover:shadow-md text-zinc-900 dark:text-zinc-100",
                        error && "border-red-500 focus:ring-red-500"
                    )}
                    {...props}
                >
                    {children}
                </select>
                <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-zinc-400">
                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </div>
            </div>
            {description && (
                <p className="text-xs text-zinc-500">{description}</p>
            )}
            {error && (
                <p className="text-xs text-red-500 font-medium">{error}</p>
            )}
        </div>
    );
};
