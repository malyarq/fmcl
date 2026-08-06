import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../utils/cn';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    children: React.ReactNode;
    title?: React.ReactNode;
    className?: string;
    bodyClassName?: string;
    bodyProps?: Omit<React.HTMLAttributes<HTMLDivElement>, 'children' | 'className' | 'id'>;
    bodyRef?: React.Ref<HTMLDivElement>;
    closeDisabled?: boolean;
    closeLabel?: string;
    hideHeader?: boolean;
    ariaLabelledBy?: string;
    overlayClassName?: string;
}

const FOCUSABLE_SELECTOR = [
    'a[href]',
    'button:not([disabled])',
    'textarea:not([disabled])',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
].join(', ');

function isFocusableElement(element: HTMLElement): boolean {
    return !element.hasAttribute('disabled') && element.getAttribute('aria-hidden') !== 'true';
}

function getFocusableElements(container: HTMLElement): HTMLElement[] {
    return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(isFocusableElement);
}

function getInitialFocusTarget(container: HTMLElement): HTMLElement {
    const autoFocusTarget =
        container.querySelector<HTMLElement>('[autofocus]') ??
        container.querySelector<HTMLElement>('[data-autofocus="true"]');

    if (autoFocusTarget && isFocusableElement(autoFocusTarget)) {
        return autoFocusTarget;
    }

    const body = container.querySelector<HTMLElement>('[data-modal-body="true"]');
    if (body) {
        const bodyFocusable = getFocusableElements(body)[0];
        if (bodyFocusable) {
            return bodyFocusable;
        }
    }

    return getFocusableElements(container)[0] ?? container;
}

function isTopmostModal(element: HTMLElement | null): boolean {
    const dialogs = document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]');
    return element !== null && dialogs[dialogs.length - 1] === element;
}

function useReducedMotionState(isOpen: boolean): boolean {
    const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

    useEffect(() => {
        if (!isOpen || typeof window === 'undefined') {
            return;
        }

        const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        const updatePreference = () => {
            setPrefersReducedMotion(
                mediaQuery.matches || document.body.classList.contains('disable-animations')
            );
        };

        updatePreference();

        const observer = new MutationObserver(updatePreference);
        observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });

        if (typeof mediaQuery.addEventListener === 'function') {
            mediaQuery.addEventListener('change', updatePreference);
        } else {
            mediaQuery.addListener(updatePreference);
        }

        return () => {
            observer.disconnect();
            if (typeof mediaQuery.removeEventListener === 'function') {
                mediaQuery.removeEventListener('change', updatePreference);
            } else {
                mediaQuery.removeListener(updatePreference);
            }
        };
    }, [isOpen]);

    return prefersReducedMotion;
}

// Generic modal with accessible dialog semantics, focus trap, and ESC close.
export const Modal: React.FC<ModalProps> = ({
    isOpen,
    onClose,
    children,
    title,
    className,
    bodyClassName,
    bodyProps,
    bodyRef,
    closeDisabled = false,
    closeLabel = 'Close dialog',
    hideHeader = false,
    ariaLabelledBy,
    overlayClassName,
}) => {
    const dialogRef = useRef<HTMLDivElement>(null);
    const lastFocusedElementRef = useRef<HTMLElement | null>(null);
    const titleId = useId();
    const contentId = useId();
    const prefersReducedMotion = useReducedMotionState(isOpen);
    const requestClose = useCallback(() => {
        if (closeDisabled) {
            return;
        }

        const previousFocused = lastFocusedElementRef.current;

        onClose();

        if (previousFocused && document.contains(previousFocused)) {
            window.setTimeout(() => {
                if (document.contains(previousFocused)) {
                    previousFocused.focus();
                }
            }, 0);
        }
    }, [closeDisabled, onClose]);

    const animationClasses = useMemo(() => ({
        overlay: prefersReducedMotion ? '' : 'animate-in fade-in duration-200',
        frame: prefersReducedMotion ? '' : 'animate-in fade-in duration-200',
        dialog: prefersReducedMotion ? '' : 'animate-in zoom-in-95 duration-200',
    }), [prefersReducedMotion]);

    useEffect(() => {
        if (!isOpen) {
            const previousFocused = lastFocusedElementRef.current;
            if (previousFocused && document.contains(previousFocused)) {
                window.setTimeout(() => {
                    if (document.contains(previousFocused)) {
                        previousFocused.focus();
                    }
                }, 0);
            }
            return;
        }

        lastFocusedElementRef.current =
            document.activeElement instanceof HTMLElement ? document.activeElement : null;

        const frame = window.requestAnimationFrame(() => {
            const dialog = dialogRef.current;
            if (!dialog) {
                return;
            }

            getInitialFocusTarget(dialog).focus();
        });

        return () => {
            window.cancelAnimationFrame(frame);
        };
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        const handleKeyDown = (event: KeyboardEvent) => {
            if (!isTopmostModal(dialogRef.current)) {
                return;
            }

            if (event.key === 'Escape') {
                event.preventDefault();
                requestClose();
                return;
            }

            if (event.key !== 'Tab') {
                return;
            }

            const dialog = dialogRef.current;
            if (!dialog) {
                return;
            }

            const focusableElements = getFocusableElements(dialog);
            if (focusableElements.length === 0) {
                event.preventDefault();
                dialog.focus();
                return;
            }

            const currentIndex = focusableElements.indexOf(document.activeElement as HTMLElement);
            const lastIndex = focusableElements.length - 1;

            event.preventDefault();

            if (event.shiftKey) {
                const previousIndex = currentIndex <= 0 ? lastIndex : currentIndex - 1;
                focusableElements[previousIndex].focus();
                return;
            }

            const nextIndex = currentIndex === -1 || currentIndex === lastIndex ? 0 : currentIndex + 1;
            focusableElements[nextIndex].focus();
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, requestClose]);

    if (!isOpen) return null;

    return (
        <>
            <div
                className={cn(
                    'fixed inset-0 z-50 bg-background/36 backdrop-blur-[2px] pointer-events-auto',
                    animationClasses.overlay,
                    overlayClassName
                )}
                onClick={requestClose}
                aria-hidden="true"
                style={{ isolation: 'isolate' }}
            />
            <div
                className={cn(
                    'fixed inset-0 z-[51] flex items-center justify-center p-2 sm:p-4 md:p-8 pointer-events-none',
                    animationClasses.frame
                )}
                style={{ isolation: 'isolate' }}
            >
                <div
                    ref={dialogRef}
                    className={cn(
                        'surface-panel pointer-events-auto flex w-full max-w-lg flex-col overflow-hidden rounded-[28px] border-border/70 bg-card/78 backdrop-blur-2xl',
                        'max-h-[95vh] sm:max-h-[90vh] md:max-h-[85vh]',
                        animationClasses.dialog,
                        className
                    )}
                    onClick={(e) => e.stopPropagation()}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby={ariaLabelledBy ?? (title ? titleId : undefined)}
                    aria-describedby={contentId}
                    tabIndex={-1}
                    style={{ isolation: 'isolate' }}
                >
                    {!hideHeader && (
                        <div className="flex items-center justify-between border-b border-border/70 bg-card/72 px-4 py-3 sm:px-6 sm:py-4">
                            <h3
                                id={titleId}
                                className="truncate pr-2 text-base font-bold text-foreground sm:text-lg"
                            >
                                {title}
                            </h3>
                            <button
                                type="button"
                                onClick={requestClose}
                                aria-label={closeLabel}
                                disabled={closeDisabled}
                                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-secondary transition-all duration-200 ease-out hover:scale-105 hover:bg-background/70 hover:text-foreground active:scale-95"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                    )}

                    <div
                        ref={bodyRef}
                        id={contentId}
                        data-modal-body="true"
                        className={cn(
                            'min-h-0 flex-1 overflow-y-auto p-4 custom-scrollbar sm:p-6',
                            bodyClassName
                        )}
                        {...bodyProps}
                    >
                        {children}
                    </div>
                </div>
            </div>
        </>
    );
};
