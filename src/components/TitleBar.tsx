

// Custom draggable title bar with window controls.
const TitleBar = () => {
    return (
        <div className="h-8 bg-gradient-to-r from-zinc-100/95 to-zinc-50/95 dark:from-zinc-900 dark:to-zinc-950 backdrop-blur-sm border-b border-zinc-200/50 dark:border-zinc-800/50 flex items-center justify-between select-none app-drag-region sticky top-0 z-50 shadow-sm">
            <div className="flex items-center px-3 space-x-2 text-xs text-zinc-600 dark:text-zinc-500 font-bold tracking-wider uppercase">
                <img src="/tray-icon.png" alt="Icon" className="w-4 h-4 opacity-75" />
                <span>FriendLauncher</span>
            </div>

            <div className="flex h-full">
                <button
                    onClick={() => window.windowControls.minimize()}
                    className="px-4 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 transition-colors flex items-center justify-center text-xs no-drag"
                >
                    ─
                </button>
                <button
                    onClick={() => window.windowControls.close()}
                    className="px-4 hover:bg-red-600 hover:text-white text-zinc-600 dark:text-zinc-400 transition-colors flex items-center justify-center text-xs no-drag"
                >
                    ✕
                </button>
            </div>
        </div>
    );
};

export default TitleBar;
