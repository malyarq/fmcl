

const TitleBar = () => {
    return (
        <div className="h-8 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between select-none app-drag-region sticky top-0 z-50">
            <div className="flex items-center px-3 space-x-2 text-xs text-zinc-500 font-bold tracking-wider uppercase">
                <img src="/tray-icon.png" alt="Icon" className="w-4 h-4 opacity-75" />
                <span>FriendLauncher</span>
            </div>

            <div className="flex h-full">
                <button
                    onClick={() => {
                        console.log('Minimize Clicked');
                        window.windowControls.minimize();
                    }}
                    className="px-4 hover:bg-zinc-800 text-zinc-400 transition-colors flex items-center justify-center text-xs no-drag"
                >
                    ─
                </button>
                <button
                    onClick={() => window.windowControls.close()}
                    className="px-4 hover:bg-red-600 hover:text-white text-zinc-400 transition-colors flex items-center justify-center text-xs no-drag"
                >
                    ✕
                </button>
            </div>
        </div>
    );
};

export default TitleBar;
