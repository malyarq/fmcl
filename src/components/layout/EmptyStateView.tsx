import { useSettings } from '../../contexts/SettingsContext';

export function EmptyStateView(props: {
  iconPath: string;
}) {
  const { iconPath } = props;
  const { getAccentHex, getAccentStyles } = useSettings();

  return (
    <div className="flex-1 flex flex-col items-center justify-center text-zinc-400 dark:text-zinc-500 p-10 select-none">
      <div className="relative mb-6">
        <img
          src={iconPath}
          className="w-32 h-32 opacity-90 mb-4 transition-all duration-500 hover:scale-105"
          style={{
            filter: `drop-shadow(0 0 30px ${getAccentHex()}) drop-shadow(0 0 60px ${getAccentHex()}40)`,
          }}
          onError={(e) => {
            // Fallback to default path if image fails to load
            if (e.currentTarget.src !== '/icon.png' && !e.currentTarget.src.includes('icon.png')) {
              e.currentTarget.src = '/icon.png';
            }
          }}
        />
        <div
          className="absolute inset-0 w-32 h-32 opacity-30 blur-2xl -z-10 transition-all duration-500"
          style={{
            backgroundColor: getAccentHex(),
            transform: 'translateY(8px)',
          }}
        />
      </div>
      <p className="text-4xl font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-700 drop-shadow-lg">
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
  );
}

