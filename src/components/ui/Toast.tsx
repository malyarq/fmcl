import React, { useEffect, useState } from 'react';
import { cn } from '../../utils/cn';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastProps {
    id: string;
    message: string;
    type: ToastType;
    duration?: number;
    onClose: (id: string) => void;
}

const toastStyles = {
    success: 'bg-green-500/90 dark:bg-green-600/90 text-white border-green-600/50 dark:border-green-500/50',
    error: 'bg-red-500/90 dark:bg-red-600/90 text-white border-red-600/50 dark:border-red-500/50',
    warning: 'bg-yellow-500/90 dark:bg-yellow-600/90 text-white border-yellow-600/50 dark:border-yellow-500/50',
    info: 'bg-blue-500/90 dark:bg-blue-600/90 text-white border-blue-600/50 dark:border-blue-500/50',
};

const toastIcons = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ',
};

export const Toast: React.FC<ToastProps> = ({
    id,
    message,
    type,
    duration = 5000,
    onClose,
}) => {
    const [isVisible, setIsVisible] = useState(true);
    const [isExiting, setIsExiting] = useState(false);

    useEffect(() => {
        if (duration > 0) {
            const timer = setTimeout(() => {
                setIsExiting(true);
                setTimeout(() => {
                    setIsVisible(false);
                    onClose(id);
                }, 200);
            }, duration);

            return () => clearTimeout(timer);
        }
    }, [duration, id, onClose]);

    const handleClose = () => {
        setIsExiting(true);
        setTimeout(() => {
            setIsVisible(false);
            onClose(id);
        }, 200);
    };

    if (!isVisible) return null;

    return (
        <div
            className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg backdrop-blur-sm border min-w-[300px] max-w-md',
                'animate-in slide-in-from-right-full duration-300',
                isExiting && 'animate-out slide-out-to-right-full duration-200',
                toastStyles[type]
            )}
            role="alert"
            aria-live="polite"
        >
            <span className="text-lg font-bold flex-shrink-0">{toastIcons[type]}</span>
            <p className="flex-1 text-sm font-medium">{message}</p>
            <button
                onClick={handleClose}
                className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors text-white/80 hover:text-white"
                aria-label="Close notification"
            >
                ✕
            </button>
        </div>
    );
};
