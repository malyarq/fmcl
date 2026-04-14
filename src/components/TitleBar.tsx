import { Minus, X } from 'lucide-react';
import { APP_ICON_PATH, LAUNCHER_MARK_PATH, isBundledAssetSource } from '../app/assets/branding';
import { useAppIcon } from '../app/hooks/useAppIcon';
import { windowControlsIPC } from '../services/ipc/windowControlsIPC';

// Custom draggable title bar with window controls.
const TitleBar = () => {
    const { iconPath } = useAppIcon();

    return (
        <div className="app-drag-region sticky top-0 z-[100] flex h-9 select-none items-center justify-between border-b border-border/70 bg-card/82 px-2 shadow-[0_6px_18px_rgba(0,0,0,0.1)] backdrop-blur-xl">
            <div className="flex items-center gap-2 px-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-secondary">
                <img src={iconPath} alt="Icon" className="w-4 h-4 opacity-75" onError={(e) => {
                    if (!isBundledAssetSource(e.currentTarget.currentSrc || e.currentTarget.src, LAUNCHER_MARK_PATH)) {
                        e.currentTarget.src = isBundledAssetSource(e.currentTarget.currentSrc || e.currentTarget.src, APP_ICON_PATH)
                          ? LAUNCHER_MARK_PATH
                          : APP_ICON_PATH;
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
