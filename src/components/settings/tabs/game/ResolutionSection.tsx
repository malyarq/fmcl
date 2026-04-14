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

      <div className="surface-soft flex items-center justify-between gap-3 p-3 transition-colors hover:bg-card/84">
        <div>
          <p className="text-sm font-medium text-foreground">{t('settings.fullscreen')}</p>
          <p className="helper-text">{t('settings.fullscreen_desc')}</p>
        </div>
        <input
          type="checkbox"
          checked={fullscreen}
          onChange={(e) => onFullscreenChange(e.target.checked)}
          className="h-4 w-4 cursor-pointer rounded border-border bg-card text-[rgb(var(--accent-main))] focus:ring-2 focus:ring-[rgb(var(--accent-main))] focus:ring-offset-2 focus:ring-offset-background"
        />
      </div>
    </>
  );
}
