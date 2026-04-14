import { useSettings } from '../../contexts/SettingsContext';
import { LAUNCHER_MARK_PATH, isBundledAssetSource } from '../../app/assets/branding';

export function EmptyStateView(props: {
  iconPath: string;
}) {
  const { iconPath } = props;
  const { getAccentHex, getAccentStyles } = useSettings();

  return (
    <div className="flex flex-1 select-none items-center justify-center p-10">
      <div className="surface-card flex max-w-md flex-col items-center px-10 py-12 text-center">
        <div className="relative mb-6">
          <img
            src={iconPath}
            className="mb-4 h-32 w-32 opacity-90 transition-all duration-500 hover:scale-105"
            style={{
              filter: `drop-shadow(0 0 30px ${getAccentHex()}) drop-shadow(0 0 60px ${getAccentHex()}40)`,
            }}
            onError={(e) => {
              if (!isBundledAssetSource(e.currentTarget.currentSrc || e.currentTarget.src, LAUNCHER_MARK_PATH)) {
                e.currentTarget.src = LAUNCHER_MARK_PATH;
              }
            }}
          />
          <div
            className="absolute inset-0 -z-10 h-32 w-32 translate-y-2 opacity-30 blur-2xl transition-all duration-500"
            style={{
              backgroundColor: getAccentHex(),
            }}
          />
        </div>
        <p className="text-4xl font-black uppercase tracking-widest text-secondary drop-shadow-lg">
          <span
            className={getAccentStyles('text').className}
            style={{
              ...getAccentStyles('text').style,
              textShadow: `0 0 20px ${getAccentHex()}40, 0 2px 4px rgba(0,0,0,0.3)`,
            }}
          >
            Friend
          </span>
          <span className="opacity-60">Launcher</span>
        </p>
      </div>
    </div>
  );
}
