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
            <div 
                className="fixed inset-0 z-[210] animate-in fade-in bg-background/72 backdrop-blur-sm duration-200 pointer-events-auto"
                onClick={onCancel}
                style={{ isolation: 'isolate' }}
            />
            <div 
                className="fixed inset-0 z-[211] flex items-center justify-center p-8 pointer-events-none animate-in fade-in duration-200"
                style={{ isolation: 'isolate' }}
            >
                <div
                    className={cn(
                        'surface-panel w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 pointer-events-auto'
                    )}
                    onClick={(e) => e.stopPropagation()}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="confirm-dialog-title"
                    aria-describedby="confirm-dialog-message"
                    style={{ isolation: 'isolate' }}
                >
                <div className="flex items-center justify-between border-b border-border/70 bg-card/88 px-6 py-4">
                    <h3 id="confirm-dialog-title" className="text-lg font-bold text-foreground">
                        {title}
                    </h3>
                </div>

                <div className="p-6">
                    <p id="confirm-dialog-message" className="mb-6 text-secondary">
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
