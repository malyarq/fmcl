import React from 'react';
import { Select } from '../../ui/Select';
import { LoadingSpinner } from '../../ui/LoadingSpinner';
import { GameTab } from '../../settings/tabs/GameTab';
import { ModloaderSection } from '../../sidebar/ModloaderSection';
import { OptifineToggle } from '../../sidebar/OptifineToggle';
import type { ModpackConfig } from '../../../contexts/ModpackContext';
import type { ModpackDetailsConfigSetters } from '../../../features/modpacks/hooks/useModpackDetailsConfig';

export interface VersionOption {
  id: string;
  type: string;
}

export interface ModpackDetailsSettingsTabProps {
  effectiveConfig: ModpackConfig | null;
  setters: ModpackDetailsConfigSetters;
  versions: VersionOption[];
  forgeVersions: string[];
  fabricVersions: string[];
  neoForgeVersions: string[];
  optiFineVersions: string[];
  onRefresh: () => Promise<void>;
  minecraftPath: string;
  t: (key: string) => string;
  getAccentStyles: (type: 'bg' | 'text' | 'border' | 'ring' | 'hover' | 'accent' | 'title' | 'soft-bg' | 'soft-border') => {
    className?: string;
    style?: React.CSSProperties;
  };
}

export const ModpackDetailsSettingsTab: React.FC<ModpackDetailsSettingsTabProps> = ({
  effectiveConfig,
  setters,
  versions,
  forgeVersions,
  fabricVersions,
  neoForgeVersions,
  optiFineVersions,
  onRefresh,
  minecraftPath,
  t,
  getAccentStyles,
}) => {
  if (!effectiveConfig) {
    return (
      <div className="flex flex-col items-center justify-center py-8 gap-3">
        <LoadingSpinner size="md" />
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{t('modpacks.loading')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white/60 dark:bg-zinc-900/40 rounded-xl border border-zinc-200/50 dark:border-zinc-800/50 p-3 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label={t('modpacks.minecraft_version')}
            value={effectiveConfig.runtime.minecraft}
            onChange={(e) => setters.setRuntimeMinecraft(e.target.value)}
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
          isOptiFineSupported={optiFineVersions.includes(effectiveConfig.runtime.minecraft)}
          useForge={effectiveConfig.runtime.modLoader?.type === 'forge'}
          useOptiFine={Boolean(effectiveConfig.game?.useOptiFine)}
          setUseOptiFine={setters.setUseOptiFine}
          t={t}
          getAccentStyles={getAccentStyles}
        />
      </div>

      <GameTab
        modpackConfig={effectiveConfig}
        setMemoryGb={(gb) => setters.setMemoryGb(gb)}
        setJavaPath={(path) => setters.setJavaPath(path)}
        setVmOptions={(options) => setters.setVmOptions(options)}
        setGameExtraArgs={(args) => setters.setGameExtraArgs(args)}
        setGameResolution={setters.setGameResolution}
        setAutoConnectServer={setters.setAutoConnectServer}
        t={t}
        getAccentStyles={getAccentStyles}
      />
    </div>
  );
};
