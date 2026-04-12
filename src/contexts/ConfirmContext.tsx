import React, { createContext, useCallback, useContext, useState } from 'react';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';

interface ConfirmOptions {
    title?: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'default' | 'danger';
    input?: {
        initialValue?: string;
        placeholder?: string;
        requireNonEmpty?: boolean;
    };
}

interface PromptOptions extends ConfirmOptions {
    input: NonNullable<ConfirmOptions['input']>;
}

interface ConfirmContextValue {
    confirm: (options: ConfirmOptions) => Promise<boolean>;
    prompt: (options: PromptOptions) => Promise<string | null>;
}

const ConfirmContext = createContext<ConfirmContextValue | undefined>(undefined);

type ConfirmRequest =
    | { kind: 'confirm'; resolve: (value: boolean) => void }
    | { kind: 'prompt'; resolve: (value: string | null) => void };

export const ConfirmProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [options, setOptions] = useState<ConfirmOptions>({ message: '' });
    const [request, setRequest] = useState<ConfirmRequest | null>(null);
    const [inputValue, setInputValue] = useState('');

    const confirm = useCallback((confirmOptions: ConfirmOptions): Promise<boolean> => {
        return new Promise((resolve) => {
            setOptions(confirmOptions);
            setInputValue(confirmOptions.input?.initialValue ?? '');
            setRequest({ kind: 'confirm', resolve });
            setIsOpen(true);
        });
    }, []);

    const prompt = useCallback((promptOptions: PromptOptions): Promise<string | null> => {
        return new Promise((resolve) => {
            setOptions(promptOptions);
            setInputValue(promptOptions.input.initialValue ?? '');
            setRequest({ kind: 'prompt', resolve });
            setIsOpen(true);
        });
    }, []);

    const resetDialog = useCallback(() => {
        setIsOpen(false);
        setRequest(null);
        setInputValue('');
    }, []);

    const handleConfirm = useCallback(() => {
        if (!request) {
            return;
        }

        if (request.kind === 'confirm') {
            request.resolve(true);
        } else {
            request.resolve(inputValue);
        }

        resetDialog();
    }, [inputValue, request, resetDialog]);

    const handleCancel = useCallback(() => {
        if (!request) {
            return;
        }

        if (request.kind === 'confirm') {
            request.resolve(false);
        } else {
            request.resolve(null);
        }

        resetDialog();
    }, [request, resetDialog]);

    const confirmDisabled = Boolean(options.input?.requireNonEmpty && inputValue.trim().length === 0);

    return (
        <ConfirmContext.Provider value={{ confirm, prompt }}>
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
                showInput={Boolean(options.input)}
                inputValue={inputValue}
                inputPlaceholder={options.input?.placeholder}
                onInputChange={setInputValue}
                confirmDisabled={confirmDisabled}
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
