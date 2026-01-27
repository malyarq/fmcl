import React from 'react';
import { Toast, ToastType } from './Toast';

export interface ToastData {
    id: string;
    message: string;
    type: ToastType;
    duration?: number;
}

interface ToastContainerProps {
    toasts: ToastData[];
    onRemove: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onRemove }) => {
    if (toasts.length === 0) return null;

    return (
        <div
            className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none"
            aria-live="polite"
            aria-label="Notifications"
        >
            {toasts.map((toast) => (
                <div key={toast.id} className="pointer-events-auto">
                    <Toast
                        id={toast.id}
                        message={toast.message}
                        type={toast.type}
                        duration={toast.duration}
                        onClose={onRemove}
                    />
                </div>
            ))}
        </div>
    );
};
