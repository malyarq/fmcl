import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
// import { X, ChevronLeft, ChevronRight, Trash2, ExternalLink } from 'lucide-react';
import type { Screenshot } from '../../../../electron/services/screenshots/screenshotService';
import { screenshotsIPC } from '../../../services/ipc/screenshotsIPC';

interface ScreenshotLightboxProps {
    screenshots: Screenshot[];
    initialIndex: number;
    instancePath: string;
    onClose: () => void;
    onDelete?: (screenshot: Screenshot) => void;
    onOpenFolder?: () => void;
    onRename?: (screenshot: Screenshot, newName: string) => void;
}

export function ScreenshotLightbox({ screenshots, initialIndex, instancePath, onClose, onDelete, onOpenFolder, onRename }: ScreenshotLightboxProps) {
    const [index, setIndex] = useState(initialIndex);
    const [isRenaming, setIsRenaming] = useState(false);
    const [renameValue, setRenameValue] = useState('');
    const current = screenshots[index];

    useEffect(() => {
        if (isRenaming) return; // Disable navigation while renaming

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowLeft') setIndex(i => (i > 0 ? i - 1 : screenshots.length - 1));
            if (e.key === 'ArrowRight') setIndex(i => (i < screenshots.length - 1 ? i + 1 : 0));
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose, screenshots.length, isRenaming]);

    const handleRenameSubmit = async () => {
        if (!renameValue.trim() || renameValue === current.name) {
            setIsRenaming(false);
            return;
        }

        try {
            await screenshotsIPC.rename(current.name, renameValue, instancePath);
            onRename?.(current, renameValue);
            setIsRenaming(false);
        } catch (e) {
            console.error('Failed to rename', e);
            alert('Failed to rename screenshot');
        }
    };

    if (!current) return null;

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm animate-in fade-in duration-200">
            {/* Toolbar */}
            <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center bg-gradient-to-b from-black/50 to-transparent">
                <div className="text-white text-sm font-medium drop-shadow-md flex items-center gap-2">
                    {isRenaming ? (
                        <div className="flex gap-2">
                            <input
                                autoFocus
                                value={renameValue}
                                onChange={(e) => setRenameValue(e.target.value)}
                                className="bg-black/50 border border-white/20 rounded px-2 py-1 text-white text-sm"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleRenameSubmit();
                                    if (e.key === 'Escape') setIsRenaming(false);
                                }}
                            />
                            <button onClick={handleRenameSubmit} className="text-green-400 hover:text-green-300">✓</button>
                            <button onClick={() => setIsRenaming(false)} className="text-red-400 hover:text-red-300">✕</button>
                        </div>
                    ) : (
                        <>
                            <span
                                onClick={() => {
                                    setRenameValue(current.name);
                                    setIsRenaming(true);
                                }}
                                className="cursor-pointer hover:underline decoration-dashed underline-offset-4"
                                title="Click to rename"
                            >
                                {current.name}
                            </span>
                            <span className="text-white/60 ml-2">({index + 1} / {screenshots.length})</span>
                        </>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={async () => {
                            try {
                                const response = await fetch(current.url);
                                const blob = await response.blob();
                                await navigator.clipboard.write([
                                    new ClipboardItem({ 'image/png': blob })
                                ]);
                            } catch (e) {
                                console.error('Failed to copy', e);
                            }
                        }}
                        className="p-2 rounded-full hover:bg-white/10 text-white transition-colors"
                        title="Copy to Clipboard"
                    >
                        <span className="text-xl">📋</span>
                    </button>
                    {onOpenFolder && (
                        <button onClick={onOpenFolder} className="p-2 rounded-full hover:bg-white/10 text-white transition-colors" title="Open Folder">
                            <span className="text-xl">📂</span>
                        </button>
                    )}
                    {onDelete && (
                        <button
                            onClick={() => {
                                onDelete(current);
                                if (screenshots.length <= 1) onClose();
                                else if (index === screenshots.length - 1) setIndex(index - 1);
                            }}
                            className="p-2 rounded-full hover:bg-white/10 text-white hover:text-red-400 transition-colors"
                            title="Delete"
                        >
                            <span className="text-xl">🗑️</span>
                        </button>
                    )}
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 text-white transition-colors">
                        <span className="text-xl">✕</span>
                    </button>
                </div>
            </div>

            {/* Navigation Left */}
            {!isRenaming && (
                <button
                    onClick={() => setIndex(i => (i > 0 ? i - 1 : screenshots.length - 1))}
                    className="absolute left-4 p-3 rounded-full hover:bg-white/10 text-white transition-colors hidden md:block"
                >
                    <span className="text-2xl">‹</span>
                </button>
            )}

            {/* Image */}
            <img
                src={current.url}
                alt={current.name}
                className="max-h-[85vh] max-w-[90vw] object-contain shadow-2xl rounded-sm"
            />

            {/* Navigation Right */}
            {!isRenaming && (
                <button
                    onClick={() => setIndex(i => (i < screenshots.length - 1 ? i + 1 : 0))}
                    className="absolute right-4 p-3 rounded-full hover:bg-white/10 text-white transition-colors hidden md:block"
                >
                    <span className="text-2xl">›</span>
                </button>
            )}
        </div>,
        document.body
    );
}
