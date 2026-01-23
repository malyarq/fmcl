import React, { useEffect } from 'react';
import { cn } from '../../utils/cn';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    children: React.ReactNode;
    title?: React.ReactNode;
    className?: string;
}

// Generic modal with ESC close and header.
export const Modal: React.FC<ModalProps> = ({
    isOpen,
    onClose,
    children,
    title,
    className
}) => {
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        if (isOpen) window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-8 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
            <div
                className={cn(
                    "bg-white/95 dark:bg-zinc-800/95 backdrop-blur-xl border border-zinc-200/50 dark:border-zinc-700/50 w-full max-w-lg rounded-2xl shadow-2xl shadow-black/30 dark:shadow-black/50 overflow-hidden animate-in zoom-in-95 duration-200",
                    className
                )}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="px-6 py-4 border-b border-zinc-200/50 dark:border-zinc-700/50 flex justify-between items-center bg-gradient-to-r from-zinc-50/80 to-white/80 dark:from-zinc-800/80 dark:to-zinc-900/80 backdrop-blur-sm">
                    <h3 className="text-lg font-bold text-zinc-900 dark:text-white">{title}</h3>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors"
                    >
                        ✕
                    </button>
                </div>

                <div className="p-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                    {children}
                </div>
            </div>
        </div>
    );
};
