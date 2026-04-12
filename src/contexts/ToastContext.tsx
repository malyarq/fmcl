import React, { createContext, useCallback, useContext, useState } from 'react';
import { ToastContainer, ToastData } from '../components/ui/ToastContainer';
import { ToastType } from '../components/ui/Toast';

interface ToastContextValue {
    showToast: (message: string, type?: ToastType, duration?: number) => void;
    success: (message: string, duration?: number) => void;
    error: (message: string, duration?: number) => void;
    warning: (message: string, duration?: number) => void;
    info: (message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<ToastData[]>([]);

    const removeToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, []);

    const showToast = useCallback((message: string, type: ToastType = 'info', duration?: number) => {
        setToasts((prev) => {
            const existingIndex = prev.findIndex(t => t.message === message && t.type === type);

            if (existingIndex !== -1) {
                // Return new array with updated toast at the END (so it pops/resets)
                // We use a new ID to force component re-mount/timer reset
                const existing = prev[existingIndex];
                const newId = `toast-${Date.now()}-${Math.random()}`;
                const others = prev.filter((_, i) => i !== existingIndex);
                return [...others, {
                    ...existing,
                    id: newId,
                    count: (existing.count || 1) + 1,
                    duration // reset duration
                }];
            }

            const id = `toast-${Date.now()}-${Math.random()}`;
            const newToast: ToastData = {
                id,
                message,
                type,
                duration,
                count: 1
            };
            return [...prev, newToast];
        });
    }, []);

    const success = useCallback((message: string, duration?: number) => {
        showToast(message, 'success', duration);
    }, [showToast]);

    const error = useCallback((message: string, duration?: number) => {
        showToast(message, 'error', duration);
    }, [showToast]);

    const warning = useCallback((message: string, duration?: number) => {
        showToast(message, 'warning', duration);
    }, [showToast]);

    const info = useCallback((message: string, duration?: number) => {
        showToast(message, 'info', duration);
    }, [showToast]);

    return (
        <ToastContext.Provider value={{ showToast, success, error, warning, info }}>
            {children}
            <ToastContainer toasts={toasts} onRemove={removeToast} />
        </ToastContext.Provider>
    );
};

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};
