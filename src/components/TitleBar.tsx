import { useState, useEffect } from 'react';
import { Minus, X } from 'lucide-react';
import { assetsIPC } from '../services/ipc/assetsIPC';
import { windowControlsIPC } from '../services/ipc/windowControlsIPC';

// Custom draggable title bar with window controls.
const TitleBar = () => {
    // In dev mode, Vite dev server serves files from public, so use direct path
    // In production, we'll update this via IPC
    const [iconPath, setIconPath] = useState(() => 
        import.meta.env.DEV ? '/icon.png' : '/icon.png'
    );

    // Get icon path from Electron (only in production, dev uses direct path)
    useEffect(() => {
        // In production, use IPC to get correct path
        if (!import.meta.env.DEV && assetsIPC.has('getIconPath')) {
            assetsIPC.getIconPath().then(path => {
                setIconPath(path);
            }).catch(() => {
                // Fallback to default path if IPC fails
                setIconPath('/icon.png');
            });
        }
    }, []);

    return (
        <div className="app-drag-region sticky top-0 z-[100] flex h-9 select-none items-center justify-between border-b border-border/70 bg-card/82 px-2 shadow-[0_6px_18px_rgba(0,0,0,0.1)] backdrop-blur-xl">
            <div className="flex items-center gap-2 px-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-secondary">
                <img src={iconPath} alt="Icon" className="w-4 h-4 opacity-75" onError={(e) => {
                    // Fallback to default path if image fails to load
                    if (e.currentTarget.src !== '/icon.png' && !e.currentTarget.src.includes('icon.png')) {
                        e.currentTarget.src = '/icon.png';
                    }
                }} />
                <span>FriendLauncher</span>
            </div>

            <div className="flex h-full items-center gap-1">
                <button
                    onClick={() => windowControlsIPC.minimize()}
                    className="no-drag flex h-7 w-8 items-center justify-center rounded-lg text-secondary transition-colors hover:bg-background/80 hover:text-foreground"
                >
                    <Minus className="h-4 w-4" />
                </button>
                <button
                    onClick={() => windowControlsIPC.close()}
                    className="no-drag flex h-7 w-8 items-center justify-center rounded-lg text-secondary transition-colors hover:bg-red-500 hover:text-white"
                >
                    <X className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
};

export default TitleBar;
