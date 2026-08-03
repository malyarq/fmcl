import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, ClipboardCopy, FolderOpen, PencilLine, Trash2 } from 'lucide-react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { useSettings } from '../../../contexts/SettingsContext';
import { useToast } from '../../../contexts/ToastContext';
import { useConfirm } from '../../../contexts/ConfirmContext';
import type { Screenshot } from '@shared/types/screenshots';
import { screenshotsIPC } from '../../../services/ipc/screenshotsIPC';

interface ScreenshotLightboxProps {
    screenshots: Screenshot[];
    initialIndex: number;
    instancePath: string;
    onClose: () => void;
    onDelete?: (screenshot: Screenshot) => Promise<boolean> | boolean;
    onOpenFolder?: () => void;
    onRename?: (screenshot: Screenshot, newName: string) => void;
}

export function ScreenshotLightbox({
    screenshots,
    initialIndex,
    instancePath,
    onClose,
    onDelete,
    onOpenFolder,
    onRename,
}: ScreenshotLightboxProps) {
    const { t } = useSettings();
    const toast = useToast();
    const confirm = useConfirm();
    const [index, setIndex] = useState(initialIndex);

    useEffect(() => {
        if (screenshots.length === 0) {
            onClose();
            return;
        }

        setIndex((currentIndex) => Math.min(currentIndex, screenshots.length - 1));
    }, [onClose, screenshots.length]);

    const current = screenshots[index];

    const goPrevious = useCallback(() => {
        setIndex((currentIndex) => (currentIndex > 0 ? currentIndex - 1 : screenshots.length - 1));
    }, [screenshots.length]);

    const goNext = useCallback(() => {
        setIndex((currentIndex) => (currentIndex < screenshots.length - 1 ? currentIndex + 1 : 0));
    }, [screenshots.length]);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'ArrowLeft') {
                event.preventDefault();
                goPrevious();
            }

            if (event.key === 'ArrowRight') {
                event.preventDefault();
                goNext();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [goNext, goPrevious]);

    const imagePosition = useMemo(() => (
        t('screenshots.position', { current: index + 1, total: screenshots.length })
    ), [index, screenshots.length, t]);

    const handleCopy = useCallback(async () => {
        if (!current) {
            return;
        }

        try {
            const response = await fetch(current.url);
            const blob = await response.blob();
            const ClipboardItemConstructor = window.ClipboardItem;

            if (!navigator.clipboard?.write || typeof ClipboardItemConstructor === 'undefined') {
                throw new Error('Clipboard image API is not available');
            }

            await navigator.clipboard.write([
                new ClipboardItemConstructor({ [blob.type || 'image/png']: blob }),
            ]);
            toast.success(t('screenshots.copySuccess'));
        } catch (error) {
            console.error('Failed to copy screenshot:', error);
            toast.error(t('screenshots.copyError'));
        }
    }, [current, t, toast]);

    const handleRename = useCallback(async () => {
        if (!current) {
            return;
        }

        const nextName = await confirm.prompt({
            title: t('screenshots.renameTitle'),
            message: t('screenshots.renamePrompt'),
            confirmText: t('general.save'),
            cancelText: t('general.cancel'),
            input: {
                initialValue: current.name,
                placeholder: current.name,
                requireNonEmpty: true,
            },
        });

        const normalizedName = nextName?.trim();
        if (!normalizedName || normalizedName === current.name) {
            return;
        }

        try {
            await screenshotsIPC.rename(current.name, normalizedName, instancePath);
            onRename?.(current, normalizedName);
            toast.success(t('screenshots.renameSuccess'));
        } catch (error) {
            console.error('Failed to rename screenshot:', error);
            toast.error(t('screenshots.renameError'));
        }
    }, [confirm, current, instancePath, onRename, t, toast]);

    const handleDelete = useCallback(async () => {
        if (!current || !onDelete) {
            return;
        }

        const deleted = await onDelete(current);
        if (!deleted) {
            return;
        }

        if (screenshots.length <= 1) {
            onClose();
            return;
        }

        if (index === screenshots.length - 1) {
            setIndex((currentIndex) => Math.max(0, currentIndex - 1));
        }
    }, [current, index, onClose, onDelete, screenshots.length]);

    if (!current) {
        return null;
    }

    return (
        <Modal
            isOpen={true}
            onClose={onClose}
            title={
                <div className="flex min-w-0 items-center gap-3">
                    <span className="truncate">{current.name}</span>
                    <span className="shrink-0 text-xs font-medium text-muted">{imagePosition}</span>
                </div>
            }
            className="max-w-[min(96vw,1200px)]"
        >
            <div className="space-y-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <p className="text-sm text-secondary">{t('screenshots.lightboxHint')}</p>
                    <div className="flex flex-wrap gap-2">
                        <Button variant="secondary" size="sm" onClick={() => void handleRename()}>
                            <PencilLine className="h-4 w-4" />
                            {t('screenshots.rename')}
                        </Button>
                        <Button variant="secondary" size="sm" onClick={() => void handleCopy()}>
                            <ClipboardCopy className="h-4 w-4" />
                            {t('screenshots.copy')}
                        </Button>
                        {onOpenFolder && (
                            <Button variant="secondary" size="sm" onClick={onOpenFolder}>
                                <FolderOpen className="h-4 w-4" />
                                {t('screenshots.openFolder')}
                            </Button>
                        )}
                        {onDelete && (
                            <Button variant="danger" size="sm" onClick={() => void handleDelete()}>
                                <Trash2 className="h-4 w-4" />
                                {t('common.remove')}
                            </Button>
                        )}
                    </div>
                </div>

                <div className="relative overflow-hidden rounded-[28px] border border-border/70 bg-background/80 p-3 shadow-[0_26px_60px_rgba(0,0,0,0.28)]">
                    {screenshots.length > 1 && (
                        <button
                            type="button"
                            className="absolute left-4 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-border/60 bg-background/88 text-secondary shadow-[0_10px_24px_rgba(0,0,0,0.18)] transition-all duration-200 hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--accent-main))] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                            aria-label={t('screenshots.previous')}
                            onClick={goPrevious}
                        >
                            <ChevronLeft className="h-5 w-5" />
                        </button>
                    )}

                    <img
                        src={current.url}
                        alt={current.name}
                        className="max-h-[70vh] w-full rounded-[22px] object-contain"
                    />

                    {screenshots.length > 1 && (
                        <button
                            type="button"
                            className="absolute right-4 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-border/60 bg-background/88 text-secondary shadow-[0_10px_24px_rgba(0,0,0,0.18)] transition-all duration-200 hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--accent-main))] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                            aria-label={t('screenshots.next')}
                            onClick={goNext}
                        >
                            <ChevronRight className="h-5 w-5" />
                        </button>
                    )}
                </div>
            </div>
        </Modal>
    );
}
