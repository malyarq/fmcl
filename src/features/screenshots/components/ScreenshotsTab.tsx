import { useEffect, useState, useCallback } from 'react';
import { FolderOpen, ImageIcon, Trash2 } from 'lucide-react';
import { useSettings } from '../../../contexts/SettingsContext';
import { useToast } from '../../../contexts/ToastContext';
import { useConfirm } from '../../../contexts/ConfirmContext';
import { screenshotsIPC } from '../../../services/ipc/screenshotsIPC';
import type { Screenshot } from '../../../../electron/services/screenshots/screenshotService';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';
import { LazyImage } from '../../../components/ui/LazyImage';
import { Button } from '../../../components/ui/Button';
import { ScreenshotLightbox } from './ScreenshotLightbox';

interface ScreenshotsTabProps {
    instancePath: string;
}

export function ScreenshotsTab({ instancePath }: ScreenshotsTabProps) {
    const { t } = useSettings();
    const toast = useToast();
    const confirm = useConfirm();
    const [screenshots, setScreenshots] = useState<Screenshot[]>([]);
    const [loading, setLoading] = useState(true);
    const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

    const loadScreenshots = useCallback(async () => {
        setLoading(true);
        try {
            const list = await screenshotsIPC.list(instancePath);
            setScreenshots(list);
        } catch (error) {
            console.error('Failed to load screenshots:', error);
            toast.error(t('screenshots.loadError'));
        } finally {
            setLoading(false);
        }
    }, [instancePath, t, toast]);

    useEffect(() => {
        void loadScreenshots();
    }, [loadScreenshots]);

    const handleDelete = useCallback(async (screenshot: Screenshot): Promise<boolean> => {
        const confirmed = await confirm.confirm({
            title: t('screenshots.deleteTitle'),
            message: t('screenshots.deleteConfirm', { name: screenshot.name }),
            confirmText: t('common.remove'),
            cancelText: t('general.cancel'),
            variant: 'danger',
        });

        if (!confirmed) {
            return false;
        }

        try {
            await screenshotsIPC.delete(screenshot.name, instancePath);
            setScreenshots((prev) => prev.filter((item) => item.name !== screenshot.name));
            toast.success(t('screenshots.deleteSuccess'));
            return true;
        } catch (error) {
            console.error('Failed to delete screenshot:', error);
            toast.error(t('screenshots.deleteError'));
            return false;
        }
    }, [confirm, instancePath, t, toast]);

    const handleOpenFolder = useCallback(async () => {
        try {
            await screenshotsIPC.openFolder(instancePath);
        } catch (error) {
            console.error('Failed to open screenshots folder:', error);
            toast.error(t('screenshots.folderError'));
        }
    }, [instancePath, t, toast]);

    const handleRename = useCallback((_screenshot: Screenshot, _newName: string) => {
        void loadScreenshots();
    }, [loadScreenshots]);

    if (loading) {
        return (
            <div className="flex justify-center p-8">
                <LoadingSpinner variant="accent" />
            </div>
        );
    }

    if (screenshots.length === 0) {
        return (
            <div className="surface-card flex flex-col items-center justify-center gap-4 p-10 text-center">
                <div className="rounded-full border border-border/60 bg-background/78 p-4 text-secondary">
                    <ImageIcon className="h-8 w-8" />
                </div>
                <div className="space-y-2">
                    <h3 className="text-lg font-bold text-foreground">{t('screenshots.emptyTitle')}</h3>
                    <p className="max-w-md text-sm text-secondary">{t('screenshots.emptyDescription')}</p>
                </div>
                <Button variant="secondary" onClick={() => void handleOpenFolder()}>
                    <FolderOpen className="h-4 w-4" />
                    {t('screenshots.openFolder')}
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-4 p-4">
            <div className="surface-muted flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                    <div className="kicker-label">{t('modpacks.tab_screenshots')}</div>
                    <p className="text-sm text-secondary">{t('screenshots.count', { count: screenshots.length })}</p>
                </div>
                <Button variant="secondary" size="sm" onClick={() => void handleOpenFolder()}>
                    <FolderOpen className="h-4 w-4" />
                    {t('screenshots.openFolder')}
                </Button>
            </div>

            <ul
                className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
                role="list"
                aria-label={t('modpacks.tab_screenshots')}
            >
                {screenshots.map((screenshot, index) => (
                    <li key={screenshot.name} className="group relative">
                        <div className="surface-card overflow-hidden p-2">
                            <button
                                type="button"
                                className="block w-full overflow-hidden rounded-2xl border border-border/70 bg-background/80 text-left transition-all duration-300 hover:border-border-active focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--accent-main))] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                                aria-haspopup="dialog"
                                aria-label={t('screenshots.openViewer', { name: screenshot.name })}
                                onClick={() => setLightboxIndex(index)}
                            >
                                <div className="relative aspect-video overflow-hidden bg-background/70">
                                    <LazyImage
                                        src={screenshot.url}
                                        alt={screenshot.name}
                                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                                    />
                                </div>
                                <div className="flex items-center justify-between gap-3 px-3 py-3">
                                    <span className="truncate text-sm font-medium text-foreground">
                                        {screenshot.name}
                                    </span>
                                    <span className="text-xs text-muted">
                                        {new Date(screenshot.createdAt).toLocaleDateString()}
                                    </span>
                                </div>
                            </button>
                        </div>
                        <button
                            type="button"
                            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full border border-border/60 bg-background/88 text-secondary shadow-[0_10px_24px_rgba(0,0,0,0.18)] opacity-0 transition-all duration-200 hover:border-red-500/40 hover:bg-red-500/12 hover:text-red-200 focus:opacity-100 focus:outline-none focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-red-400/70 group-focus-within:opacity-100 group-hover:opacity-100"
                            aria-label={t('screenshots.deleteAction', { name: screenshot.name })}
                            onClick={() => {
                                void handleDelete(screenshot);
                            }}
                        >
                            <Trash2 className="h-4 w-4" />
                        </button>
                    </li>
                ))}
            </ul>

            {lightboxIndex !== null && (
                <ScreenshotLightbox
                    screenshots={screenshots}
                    initialIndex={lightboxIndex}
                    instancePath={instancePath}
                    onClose={() => setLightboxIndex(null)}
                    onDelete={handleDelete}
                    onOpenFolder={handleOpenFolder}
                    onRename={handleRename}
                />
            )}
        </div>
    );
}
