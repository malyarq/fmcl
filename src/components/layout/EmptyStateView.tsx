import { APP_ICON_PATH, isBundledAssetSource } from '../../app/assets/branding';
import { BrandMark } from '../branding/BrandMark';

export function EmptyStateView(props: {
  iconPath: string;
}) {
  const { iconPath } = props;

  return (
    <div className="flex flex-1 select-none items-center justify-center p-10">
      <div className="surface-card flex max-w-md flex-col items-center gap-4 px-10 py-12 text-center">
        <div
          data-testid="empty-state-placeholder"
          className="flex h-32 w-32 items-center justify-center rounded-[2rem] border border-border/70 bg-background/72"
        >
          <div className="flex h-20 w-20 items-center justify-center rounded-[1.65rem] border border-border/60 bg-card/84 shadow-inner">
            <BrandMark
              role="app-icon"
              src={iconPath}
              alt="FriendLauncher app icon"
              data-testid="empty-state-brand-mark"
              frame="none"
              size="lg"
              className="h-14 w-14 opacity-80"
              onError={(e) => {
                if (!isBundledAssetSource(e.currentTarget.currentSrc || e.currentTarget.src, APP_ICON_PATH)) {
                  e.currentTarget.src = APP_ICON_PATH;
                }
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
