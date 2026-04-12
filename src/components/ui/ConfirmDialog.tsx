import React, { useEffect } from 'react';
import { cn } from '../../utils/cn';
import { Button } from './Button';
import { Input } from './Input';

export interface ConfirmDialogProps {
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
    onCancel: () => void;
    variant?: 'default' | 'danger';
    showInput?: boolean;
    inputValue?: string;
    inputPlaceholder?: string;
    onInputChange?: (value: string) => void;
    confirmDisabled?: boolean;
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
    showInput = false,
    inputValue = '',
    inputPlaceholder,
    onInputChange,
    confirmDisabled = false,
}) => {
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                onCancel();
            }

            if (e.key === 'Enter' && isOpen && !confirmDisabled) {
                onConfirm();
            }
        };
        if (isOpen) {
            window.addEventListener('keydown', handleEsc);
        }
        return () => window.removeEventListener('keydown', handleEsc);
    }, [confirmDisabled, isOpen, onCancel, onConfirm]);

    if (!isOpen) return null;

    return (
        <>
            {/* Background overlay — затемнение без блюра */}
            <div 
                className="fixed inset-0 z-[100] bg-black/70 animate-in fade-in duration-200 pointer-events-auto" 
                onClick={onCancel}
                style={{ isolation: 'isolate' }}
            />
            <div 
                className="fixed inset-0 z-[101] flex items-center justify-center p-8 pointer-events-none animate-in fade-in duration-200"
                style={{ isolation: 'isolate' }}
            >
                <div
                    className={cn(
                        'bg-white dark:bg-zinc-800 border border-zinc-200/50 dark:border-zinc-700/50 w-full max-w-md rounded-2xl shadow-2xl shadow-black/30 dark:shadow-black/50 overflow-hidden animate-in zoom-in-95 duration-200 pointer-events-auto'
                    )}
                    onClick={(e) => e.stopPropagation()}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="confirm-dialog-title"
                    aria-describedby="confirm-dialog-message"
                    style={{ isolation: 'isolate' }}
                >
                <div className="px-6 py-4 border-b border-zinc-200/50 dark:border-zinc-700/50 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900">
                    <h3 id="confirm-dialog-title" className="text-lg font-bold text-zinc-900 dark:text-white">
                        {title}
                    </h3>
                </div>

                <div className="p-6">
                    <p id="confirm-dialog-message" className="text-zinc-700 dark:text-zinc-300 mb-6">
                        {message}
                    </p>

                    {showInput && (
                        <div className="mb-6">
                            <Input
                                autoFocus
                                value={inputValue}
                                onChange={(event) => onInputChange?.(event.target.value)}
                                placeholder={inputPlaceholder}
                            />
                        </div>
                    )}

                    <div className="flex gap-3 justify-end">
                        <Button variant="secondary" onClick={onCancel}>
                            {cancelText}
                        </Button>
                        <Button
                            variant={variant === 'danger' ? 'danger' : 'primary'}
                            onClick={onConfirm}
                            disabled={confirmDisabled}
                        >
                            {confirmText}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
        </>
    );
};
