import { useState, useEffect } from 'react';
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
        <div className="h-8 bg-gradient-to-r from-zinc-100/95 to-zinc-50/95 dark:from-zinc-900 dark:to-zinc-950 backdrop-blur-sm border-b border-zinc-200/50 dark:border-zinc-800/50 flex items-center justify-between select-none app-drag-region sticky top-0 z-[100] shadow-sm">
            <div className="flex items-center px-3 space-x-2 text-xs text-zinc-600 dark:text-zinc-500 font-bold tracking-wider uppercase">
                <img src={iconPath} alt="Icon" className="w-4 h-4 opacity-75" onError={(e) => {
                    // Fallback to default path if image fails to load
                    if (e.currentTarget.src !== '/icon.png' && !e.currentTarget.src.includes('icon.png')) {
                        e.currentTarget.src = '/icon.png';
                    }
                }} />
                <span>FriendLauncher</span>
            </div>

            <div className="flex h-full">
                <button
                    onClick={() => windowControlsIPC.minimize()}
                    className="px-4 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 transition-colors flex items-center justify-center text-xs no-drag"
                >
                    ─
                </button>
                <button
                    onClick={() => windowControlsIPC.close()}
                    className="px-4 hover:bg-red-600 hover:text-white text-zinc-600 dark:text-zinc-400 transition-colors flex items-center justify-center text-xs no-drag"
                >
                    ✕
                </button>
            </div>
        </div>
    );
};

export default TitleBar;
