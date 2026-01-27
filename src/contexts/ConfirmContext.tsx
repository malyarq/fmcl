import React, { createContext, useCallback, useContext, useState } from 'react';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';

interface ConfirmOptions {
    title?: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'default' | 'danger';
}

interface ConfirmContextValue {
    confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextValue | undefined>(undefined);

export const ConfirmProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [options, setOptions] = useState<ConfirmOptions>({ message: '' });
    const [resolvePromise, setResolvePromise] = useState<((value: boolean) => void) | null>(null);

    const confirm = useCallback((confirmOptions: ConfirmOptions): Promise<boolean> => {
        return new Promise((resolve) => {
            setOptions(confirmOptions);
            setResolvePromise(() => resolve);
            setIsOpen(true);
        });
    }, []);

    const handleConfirm = useCallback(() => {
        setIsOpen(false);
        if (resolvePromise) {
            resolvePromise(true);
            setResolvePromise(null);
        }
    }, [resolvePromise]);

    const handleCancel = useCallback(() => {
        setIsOpen(false);
        if (resolvePromise) {
            resolvePromise(false);
            setResolvePromise(null);
        }
    }, [resolvePromise]);

    return (
        <ConfirmContext.Provider value={{ confirm }}>
            {children}
            <ConfirmDialog
                isOpen={isOpen}
                title={options.title || 'Confirm'}
                message={options.message}
                confirmText={options.confirmText}
                cancelText={options.cancelText}
                onConfirm={handleConfirm}
                onCancel={handleCancel}
                variant={options.variant}
            />
        </ConfirmContext.Provider>
    );
};

export const useConfirm = () => {
    const context = useContext(ConfirmContext);
    if (!context) {
        throw new Error('useConfirm must be used within a ConfirmProvider');
    }
    return context;
};
