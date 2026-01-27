import React, { useEffect, useState } from 'react';
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
    const [isAnimating, setIsAnimating] = useState(false);
    const [shouldRender, setShouldRender] = useState(false);

    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) onClose();
        };
        if (isOpen) window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [isOpen, onClose]);

    useEffect(() => {
        if (isOpen) {
            // Use setTimeout to avoid synchronous setState in effect
            setTimeout(() => {
                setShouldRender(true);
                // Небольшая задержка для запуска анимации появления
                requestAnimationFrame(() => {
                    setIsAnimating(true);
                });
            }, 0);
        } else {
            // Use setTimeout to avoid synchronous setState in effect
            let timer: NodeJS.Timeout;
            setTimeout(() => {
                setIsAnimating(false);
                // Ждем завершения анимации закрытия перед размонтированием
                timer = setTimeout(() => {
                    setShouldRender(false);
                }, 300);
            }, 0);
            return () => {
                if (timer) clearTimeout(timer);
            };
        }
    }, [isOpen]);

    if (!shouldRender) return null;

    return (
        <div 
            className={cn(
                "fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-8 bg-black/70 backdrop-blur-md transition-opacity duration-300 ease-out",
                isAnimating ? "opacity-100" : "opacity-0"
            )}
            onClick={onClose}
        >
            <div
                className={cn(
                    "bg-white/95 dark:bg-zinc-800/95 backdrop-blur-xl border border-zinc-200/50 dark:border-zinc-700/50 w-full max-w-lg rounded-xl sm:rounded-2xl shadow-2xl shadow-black/30 dark:shadow-black/50 overflow-hidden transition-all duration-300 ease-out transform",
                    "max-h-[95vh] sm:max-h-[90vh] md:max-h-[85vh]",
                    isAnimating ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-4",
                    className
                )}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-zinc-200/50 dark:border-zinc-700/50 flex justify-between items-center bg-gradient-to-r from-zinc-50/80 to-white/80 dark:from-zinc-800/80 dark:to-zinc-900/80 backdrop-blur-sm">
                    <h3 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-white truncate pr-2">{title}</h3>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-all duration-200 ease-out hover:scale-110 active:scale-95 flex-shrink-0"
                    >
                        ✕
                    </button>
                </div>

                <div className="p-4 sm:p-6 max-h-[calc(95vh-80px)] sm:max-h-[calc(90vh-80px)] md:max-h-[70vh] overflow-y-auto custom-scrollbar">
                    {children}
                </div>
            </div>
        </div>
    );
};
