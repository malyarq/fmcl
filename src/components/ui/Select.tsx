import React from 'react';
import { cn } from '../../utils/cn';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
    label?: string;
    description?: string;
    error?: string;
}

export const Select: React.FC<SelectProps> = ({
    label,
    description,
    error,
    className,
    children,
    ...props
}) => {
    return (
        <div className="flex flex-col gap-1.5 w-full">
            {label && (
                <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                    {label}
                </label>
            )}
            <div className="relative">
                <select
                    className={cn(
                        "w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2.5 text-sm",
                        "focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-600 focus:border-transparent",
                        "appearance-none cursor-pointer transition-colors text-zinc-900 dark:text-zinc-100",
                        error && "border-red-500 focus:ring-red-500",
                        className
                    )}
                    {...props}
                >
                    {children}
                </select>
                <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-zinc-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
