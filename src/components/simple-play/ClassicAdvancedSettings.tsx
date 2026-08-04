import type { ModpackConfig } from '../../contexts/instances/types';
import { useSettings } from '../../contexts/SettingsContext';
import { GameTab } from '../settings/tabs/GameTab';
import { CollapsibleSection } from '../ui/CollapsibleSection';

export interface ClassicAdvancedSettingsProps {
  config: ModpackConfig;
  readOnly: boolean;
  onMemoryChange: (gb: number) => void;
  onMinMemoryChange: (gb: number) => void;
  onVmOptionsChange: (options: string[]) => void;
  onGameArgsChange: (args: string[]) => void;
  onResolutionChange: (resolution?: { width?: number; height?: number; fullscreen?: boolean }) => void;
  onAutoConnectChange: (server?: { host: string; port: number }) => void;
}

export function ClassicAdvancedSettings({
  config,
  readOnly,
  onMemoryChange,
  onMinMemoryChange,
  onVmOptionsChange,
  onGameArgsChange,
  onResolutionChange,
  onAutoConnectChange,
}: ClassicAdvancedSettingsProps) {
  const { t, getAccentStyles } = useSettings();
  const title = t('dashboard.advanced_settings') || 'Advanced settings';
  const editor = (
    <GameTab
      modpackConfig={config}
      setMemoryGb={onMemoryChange}
      setMinMemoryGb={onMinMemoryChange}
      setVmOptions={onVmOptionsChange}
      setGameExtraArgs={onGameArgsChange}
      setGameResolution={onResolutionChange}
      setAutoConnectServer={onAutoConnectChange}
      t={t}
      getAccentStyles={getAccentStyles}
      isReadOnly={readOnly}
    />
  );

  if (readOnly) {
    return (
      <section className="mt-6 w-full max-w-2xl" aria-label={title}>
        <div className="space-y-2">
          <div className="flex w-full items-center justify-between rounded-xl border border-border/60 bg-card/68 px-3 py-2 text-left text-xs font-bold uppercase tracking-wider text-secondary">
            <span>{title}</span>
          </div>
          <div className="space-y-3 pt-2">{editor}</div>
        </div>
      </section>
    );
  }

  return (
    <CollapsibleSection
      title={title}
      defaultExpanded={false}
      storageKey="classic_game_settings_expanded"
      className="mt-6 w-full max-w-2xl"
    >
      {editor}
    </CollapsibleSection>
  );
}
