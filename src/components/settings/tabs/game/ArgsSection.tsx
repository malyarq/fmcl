export function ArgsSection(props: {
  vmArgsText: string;
  mcArgsText: string;
  onVmArgsTextChange: (v: string) => void;
  onMcArgsTextChange: (v: string) => void;
  t: (key: string) => string;
}) {
  const { vmArgsText, mcArgsText, onVmArgsTextChange, onMcArgsTextChange, t } = props;

  return (
    <>
      <div className="space-y-2">
        <label className="text-sm font-medium text-zinc-600 dark:text-zinc-300 block">
          {t('settings.extra_jvm_args')}
        </label>
        <p className="text-xs text-zinc-500">{t('settings.extra_jvm_args_desc')}</p>
        <textarea
          value={vmArgsText}
          onChange={(e) => {
            const v = e.target.value;
            onVmArgsTextChange(v);
          }}
          placeholder="-XX:+UseG1GC&#10;-Dsome.flag=true"
          rows={4}
          className="w-full bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm border border-zinc-300/50 dark:border-zinc-700/50 rounded-lg p-3 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-600 shadow-sm hover:shadow-md transition-all resize-y"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-zinc-600 dark:text-zinc-300 block">
          {t('settings.extra_game_args')}
        </label>
        <p className="text-xs text-zinc-500">{t('settings.extra_game_args_desc')}</p>
        <textarea
          value={mcArgsText}
          onChange={(e) => {
            const v = e.target.value;
            onMcArgsTextChange(v);
          }}
          placeholder="--demo"
          rows={3}
          className="w-full bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm border border-zinc-300/50 dark:border-zinc-700/50 rounded-lg p-3 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-600 shadow-sm hover:shadow-md transition-all resize-y"
        />
      </div>
    </>
  );
}

