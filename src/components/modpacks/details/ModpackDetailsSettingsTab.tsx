import React from 'react';
import { Select } from '../../ui/Select';
import { LoadingSpinner } from '../../ui/LoadingSpinner';
import { GameTab } from '../../settings/tabs/GameTab';
import { ModloaderSection } from '../../sidebar/ModloaderSection';
import { ModpackDependencySummary } from '../../sidebar/ModpackDependencySummary';
import { OptifineToggle } from '../../sidebar/OptifineToggle';
import type { ModpackConfig } from '../../../contexts/ModpackContext';
import type { ModpackDetailsConfigSetters } from '../../../features/modpacks/hooks/useModpackDetailsConfig';
import type { ModpackRuntimeSummary } from '../../../features/modpacks/hooks/useModpackRuntimeSummary';

export interface VersionOption {
  id: string;
  type: string;
}

export interface ModpackDetailsSettingsTabProps {
  effectiveConfig: ModpackConfig | null;
  runtimeSummary: ModpackRuntimeSummary;
  setters: ModpackDetailsConfigSetters;
  versions: VersionOption[];
  forgeVersions: string[];
  fabricVersions: string[];
  neoForgeVersions: string[];
  optiFineVersions: string[];
  onRefresh: () => Promise<void>;
  t: (key: string) => string;
  getAccentStyles: (type: 'bg' | 'text' | 'border' | 'ring' | 'hover' | 'accent' | 'title' | 'soft-bg' | 'soft-border') => {
    className?: string;
    style?: React.CSSProperties;
  };
}

export const ModpackDetailsSettingsTab: React.FC<ModpackDetailsSettingsTabProps> = ({
  effectiveConfig,
  runtimeSummary,
  setters,
  versions,
  forgeVersions,
  fabricVersions,
  neoForgeVersions,
  optiFineVersions,
  onRefresh: _onRefresh,
  t,
  getAccentStyles,
}) => {
  if (!effectiveConfig) {
    return (
      <div className="surface-inline flex flex-col items-center justify-center gap-3 p-6 text-sm text-secondary" role="status">
        <LoadingSpinner size="md" variant="accent" />
        <p>{t('modpacks.loading')}</p>
      </div>
    );
  }

  const isOptiFineSupported = optiFineVersions.includes(effectiveConfig.runtime.minecraft);

  const handleMinecraftVersionChange = async (minecraftVersion: string) => {
    await setters.setRuntimeMinecraft(minecraftVersion);
    if (Boolean(effectiveConfig.game?.useOptiFine) && !optiFineVersions.includes(minecraftVersion)) {
      await setters.setUseOptiFine(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="surface-card space-y-4 p-4">
        <div className="space-y-2">
          <div className="kicker-label">{t('modpacks.tab_settings')}</div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">{t('modpacks.tab_settings')}</h3>
            <p className="text-sm text-secondary">{t('modpacks.runtime_settings_description')}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label={t('modpacks.minecraft_version')}
            value={effectiveConfig.runtime.minecraft}
            onChange={(e) => {
              void handleMinecraftVersionChange(e.target.value);
            }}
          >
            {versions
              .filter((v) => v.type === 'release')
              .map((v) => (
                <option key={v.id} value={v.id}>
                  {v.id}
                </option>
              ))}
          </Select>
        </div>

        <ModloaderSection
          version={effectiveConfig.runtime.minecraft}
          useForge={effectiveConfig.runtime.modLoader?.type === 'forge'}
          setUseForge={(val) => setters.setRuntimeLoader(val ? 'forge' : 'vanilla')}
          useFabric={effectiveConfig.runtime.modLoader?.type === 'fabric'}
          setUseFabric={(val) => setters.setRuntimeLoader(val ? 'fabric' : 'vanilla')}
          useNeoForge={effectiveConfig.runtime.modLoader?.type === 'neoforge'}
          setUseNeoForge={(val) => setters.setRuntimeLoader(val ? 'neoforge' : 'vanilla')}
          setLoader={(loader) => setters.setRuntimeLoader(loader)}
          forgeSupportedVersions={forgeVersions}
          fabricSupportedVersions={fabricVersions}
          neoForgeSupportedVersions={neoForgeVersions}
          t={t}
          getAccentStyles={getAccentStyles}
        />

        <OptifineToggle
          isOptiFineSupported={isOptiFineSupported}
          useForge={effectiveConfig.runtime.modLoader?.type === 'forge'}
          useOptiFine={Boolean(effectiveConfig.game?.useOptiFine)}
          setUseOptiFine={setters.setUseOptiFine}
          t={t}
          getAccentStyles={getAccentStyles}
        />

        <ModpackDependencySummary runtime={runtimeSummary.runtime} status={runtimeSummary.status} t={t} />
      </div>

      <div className="surface-card p-1">
        <GameTab
          modpackConfig={effectiveConfig}
          setMemoryGb={(gb) => setters.setMemoryGb(gb)}
          setMinMemoryGb={(gb) => setters.setMinMemoryGb(gb)}
          setVmOptions={(options) => setters.setVmOptions(options)}
          setGameExtraArgs={(args) => setters.setGameExtraArgs(args)}
          setGameResolution={setters.setGameResolution}
          setAutoConnectServer={setters.setAutoConnectServer}
          t={t}
          getAccentStyles={getAccentStyles}
        />
      </div>
    </div>
  );
};
