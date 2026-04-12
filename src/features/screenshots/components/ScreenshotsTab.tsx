import { useEffect, useState, useCallback } from 'react';
import { useSettings } from '../../../contexts/SettingsContext';
import { screenshotsIPC } from '../../../services/ipc/screenshotsIPC';
import type { Screenshot } from '../../../../electron/services/screenshots/screenshotService';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';
import { LazyImage } from '../../../components/ui/LazyImage';
import { ScreenshotLightbox } from './ScreenshotLightbox';

interface ScreenshotsTabProps {
    instancePath: string;
}

export function ScreenshotsTab({ instancePath }: ScreenshotsTabProps) {
    const { t } = useSettings();
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
        } finally {
            setLoading(false);
        }
    }, [instancePath]);

    useEffect(() => {
        loadScreenshots();
    }, [loadScreenshots]);

    const handleDelete = async (screenshot: Screenshot) => {
        if (!confirm(t('Are you sure you want to delete this screenshot?'))) return;

        try {
            await screenshotsIPC.delete(screenshot.name, instancePath);
            setScreenshots(prev => prev.filter(s => s.name !== screenshot.name));
        } catch (error) {
            console.error('Failed to delete screenshot:', error);
        }
    };

    const handleOpenFolder = async () => {
        await screenshotsIPC.openFolder(instancePath);
    };

    if (loading) {
        return <div className="flex justify-center p-8"><LoadingSpinner /></div>;
    }

    if (screenshots.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center">
                <div className="text-4xl mb-4 opacity-50">🖼️</div>
                <h3 className="text-lg font-medium text-zinc-100 mb-2">{t('No screenshots yet')}</h3>
                <p className="text-zinc-400 max-w-xs">{t('Take screenshots in-game using F2. They will appear here.')}</p>
                <button
                    onClick={handleOpenFolder}
                    className="mt-4 text-primary text-sm hover:underline"
                >
                    {t('Open Screenshots Folder')}
                </button>
            </div>
        );
    }

    return (
        <div className="p-4">
            <div className="flex justify-between items-center mb-4">
                <div className="text-sm text-zinc-400">
                    {screenshots.length} {t('screenshots')}
                </div>
                <button
                    onClick={handleOpenFolder}
                    className="text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-3 py-1.5 rounded transition-colors"
                >
                    {t('Open Folder')}
                </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {screenshots.map((screenshot, index) => (
                    <div
                        key={screenshot.name}
                        className="group relative aspect-video bg-zinc-900 rounded-lg overflow-hidden border border-zinc-800 hover:border-zinc-700 transition-all cursor-pointer"
                        onClick={() => setLightboxIndex(index)}
                    >
                        <LazyImage
                            src={screenshot.url}
                            alt={screenshot.name}
                            className="w-full h-full object-cover transition-transform group-hover:scale-105"
                        />

                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-end justify-between p-2 opacity-0 group-hover:opacity-100">
                            <span className="text-xs text-white truncate max-w-[70%] font-medium drop-shadow-md">
                                {screenshot.name}
                            </span>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleDelete(screenshot);
                                }}
                                className="p-1.5 rounded-full bg-black/50 hover:bg-red-500/80 text-white transition-colors backdrop-blur-sm"
                                title={t('Delete')}
                            >
                                <span className="text-xs">🗑️</span>
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {lightboxIndex !== null && (
                <ScreenshotLightbox
                    screenshots={screenshots}
                    initialIndex={lightboxIndex}
                    instancePath={instancePath}
                    onClose={() => setLightboxIndex(null)}
                    onDelete={(s) => {
                        handleDelete(s);
                    }}
                    onOpenFolder={handleOpenFolder}
                    onRename={(s, newName) => {
                        setScreenshots(prev => prev.map(item =>
                            item.name === s.name
                                ? { ...item, name: newName, url: item.url } // Update name, keep url (it might be invalid if based on path, but usually data url or blob, but here it's local protocol). Actually if url depends on name, this might be tricky. The backend returns 'atom://...' which usually includes path. If specific screenshot renamed, path changes. We might need to reload or update url manually if predictable. 
                                // However, simple list reload is safest but might flicker. Let's try simple update first.
                                // If URL is `atom://screenshots/${instancePath}/${name}`, then it must update.
                                : item
                        ));
                        // Reload to be safe about URLs
                        loadScreenshots();
                    }}
                />
            )}
        </div>
    );
}
