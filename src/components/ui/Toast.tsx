import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { cn } from '../../utils/cn';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastProps {
    id: string;
    message: string;
    type: ToastType;
    duration?: number;
    count?: number;
    onClose: (id: string) => void;
}

const toastStyles = {
    success: 'border-green-500/25 bg-green-500/14 text-foreground',
    error: 'border-red-500/25 bg-red-500/14 text-foreground',
    warning: 'border-amber-500/25 bg-amber-500/14 text-foreground',
    info: 'border-blue-500/25 bg-blue-500/14 text-foreground',
};

const toastIcons = {
    success: CheckCircle2,
    error: XCircle,
    warning: AlertTriangle,
    info: Info,
};

export const Toast: React.FC<ToastProps> = ({
    id,
    message,
    type,
    duration = 5000,
    count = 1,
    onClose,
}) => {
    const [isVisible, setIsVisible] = useState(true);
    const [isExiting, setIsExiting] = useState(false);
    const Icon = toastIcons[type];

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
                'flex min-w-[300px] max-w-md items-center gap-3 rounded-2xl border px-4 py-3 shadow-[0_18px_48px_rgba(0,0,0,0.18)] backdrop-blur-xl',
                'animate-in slide-in-from-right-full duration-300',
                isExiting && 'animate-out slide-out-to-right-full duration-200',
                toastStyles[type]
            )}
            role="alert"
            aria-live="polite"
        >
            <span className="flex-shrink-0 text-lg font-bold">
                <Icon className="h-5 w-5" />
            </span>
            <p className="flex-1 text-sm font-medium">
                {message}
                {count > 1 && (
                    <span className="ml-2 inline-block rounded-full bg-background/80 px-1.5 py-0.5 align-middle text-xs font-bold text-foreground">
                        x{count}
                    </span>
                )}
            </p>
            <button
                onClick={handleClose}
                className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-secondary transition-colors hover:bg-background/70 hover:text-foreground"
                aria-label="Close notification"
            >
                <X className="h-4 w-4" />
            </button>
        </div>
    );
};
