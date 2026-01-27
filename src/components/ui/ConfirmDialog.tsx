import React, { useEffect } from 'react';
import { cn } from '../../utils/cn';
import { Button } from './Button';

export interface ConfirmDialogProps {
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
    onCancel: () => void;
    variant?: 'default' | 'danger';
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
    isOpen,
    title,
    message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    onConfirm,
    onCancel,
    variant = 'default',
}) => {
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                onCancel();
            }
        };
        if (isOpen) {
            window.addEventListener('keydown', handleEsc);
        }
        return () => window.removeEventListener('keydown', handleEsc);
    }, [isOpen, onCancel]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-8 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
            <div
                className={cn(
                    'bg-white/95 dark:bg-zinc-800/95 backdrop-blur-xl border border-zinc-200/50 dark:border-zinc-700/50 w-full max-w-md rounded-2xl shadow-2xl shadow-black/30 dark:shadow-black/50 overflow-hidden animate-in zoom-in-95 duration-200'
                )}
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="confirm-dialog-title"
                aria-describedby="confirm-dialog-message"
            >
                <div className="px-6 py-4 border-b border-zinc-200/50 dark:border-zinc-700/50 flex justify-between items-center bg-gradient-to-r from-zinc-50/80 to-white/80 dark:from-zinc-800/80 dark:to-zinc-900/80 backdrop-blur-sm">
                    <h3 id="confirm-dialog-title" className="text-lg font-bold text-zinc-900 dark:text-white">
                        {title}
                    </h3>
                </div>

                <div className="p-6">
                    <p id="confirm-dialog-message" className="text-zinc-700 dark:text-zinc-300 mb-6">
                        {message}
                    </p>

                    <div className="flex gap-3 justify-end">
                        <Button variant="secondary" onClick={onCancel}>
                            {cancelText}
                        </Button>
                        <Button variant={variant === 'danger' ? 'danger' : 'primary'} onClick={onConfirm}>
                            {confirmText}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};
