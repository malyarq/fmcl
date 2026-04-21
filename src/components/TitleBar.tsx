import { Minus, X } from 'lucide-react';
import { getBrandAssetPath, isBrandAssetSource } from '../app/assets/branding';
import { useAppIcon } from '../app/hooks/useAppIcon';
import { windowControlsIPC } from '../services/ipc/windowControlsIPC';
import { BrandMark } from './branding/BrandMark';
import { BrandWordmark } from './branding/BrandWordmark';

export const TITLE_BAR_TEST_ID = 'app-title-bar';

const APP_ICON_PATH = getBrandAssetPath('app-icon');
const PRODUCT_MARK_PATH = getBrandAssetPath('product-mark');

// Custom draggable title bar with window controls.
const TitleBar = () => {
    const { iconPath } = useAppIcon();
    const usesNativeWindowControls = windowControlsIPC.usesNativeWindowControls();

    if (usesNativeWindowControls) {
        return (
            <div
                data-testid={TITLE_BAR_TEST_ID}
                data-platform="macos"
                className="app-drag-region relative z-[100] h-8 shrink-0 select-none border-b border-border/50 bg-background/78 backdrop-blur-lg"
            />
        );
    }

    return (
        <div
            data-testid={TITLE_BAR_TEST_ID}
            data-platform="default"
            className="app-drag-region relative z-[100] flex h-9 select-none items-center justify-between border-b border-border/70 bg-card/82 px-2 shadow-[0_6px_18px_rgba(0,0,0,0.1)] backdrop-blur-xl"
        >
            <div className="flex items-center gap-2 px-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-secondary">
                <BrandMark
                    role="app-icon"
                    src={iconPath}
                    alt="FriendLauncher app icon"
                    size="xs"
                    data-testid="title-bar-brand-icon"
                    className="opacity-80"
                    onError={(e) => {
                        const currentSrc = e.currentTarget.currentSrc || e.currentTarget.src;
                        if (!isBrandAssetSource(currentSrc, 'product-mark')) {
                            e.currentTarget.src = isBrandAssetSource(currentSrc, 'app-icon')
                              ? PRODUCT_MARK_PATH
                              : APP_ICON_PATH;
                        }
                    }}
                />
                <BrandWordmark tone="shell" className="text-secondary" />
            </div>

            <div data-testid="title-bar-window-controls" className="flex h-full items-center gap-1">
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
