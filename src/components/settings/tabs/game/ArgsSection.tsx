import { Textarea } from '../../../ui/Textarea';

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
        <Textarea
          label={t('settings.extra_jvm_args')}
          value={vmArgsText}
          onChange={(e) => {
            const v = e.target.value;
            onVmArgsTextChange(v);
          }}
          placeholder="-XX:+UseG1GC&#10;-Dsome.flag=true"
          rows={4}
        />
        <p className="helper-text">{t('settings.extra_jvm_args_desc')}</p>
      </div>

      <div className="space-y-2">
        <Textarea
          label={t('settings.extra_game_args')}
          value={mcArgsText}
          onChange={(e) => {
            const v = e.target.value;
            onMcArgsTextChange(v);
          }}
          placeholder="--demo"
          rows={3}
        />
        <p className="helper-text">{t('settings.extra_game_args_desc')}</p>
      </div>
    </>
  );
}
