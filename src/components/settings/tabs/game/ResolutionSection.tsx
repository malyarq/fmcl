import { Input } from '../../../ui/Input';

export function ResolutionSection(props: {
  widthInput: string;
  heightInput: string;
  fullscreen: boolean;
  onWidthInputChange: (next: string) => void;
  onHeightInputChange: (next: string) => void;
  onFullscreenChange: (next: boolean) => void;
  t: (key: string) => string;
}) {
  const { widthInput, heightInput, fullscreen, onWidthInputChange, onHeightInputChange, onFullscreenChange, t } = props;

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label={t('settings.window_width')}
          type="number"
          min={0}
          value={widthInput}
          onChange={(e) => onWidthInputChange(e.target.value)}
          placeholder="854"
        />
        <Input
          label={t('settings.window_height')}
          type="number"
          min={0}
          value={heightInput}
          onChange={(e) => onHeightInputChange(e.target.value)}
          placeholder="480"
        />
      </div>

      <div className="flex items-center justify-between p-3 bg-white/60 dark:bg-zinc-900/60 backdrop-blur-sm rounded-xl border border-zinc-200/50 dark:border-zinc-800/50 shadow-sm hover:shadow-md transition-all">
        <div>
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-200">{t('settings.fullscreen')}</p>
          <p className="text-xs text-zinc-500">{t('settings.fullscreen_desc')}</p>
        </div>
        <input
          type="checkbox"
          checked={fullscreen}
          onChange={(e) => onFullscreenChange(e.target.checked)}
          className="w-4 h-4 rounded cursor-pointer accent-current text-zinc-800 dark:text-white"
        />
      </div>
    </>
  );
}

