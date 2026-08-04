import type { CSSProperties } from 'react';
import type { MCVersion } from '../../../services/versions/types';
import type { ModpackCreationDraft } from '../../../features/modpacks/hooks/useModpackCreationDraft';
import type { RuntimeDependencyState } from '../../sidebar/modpackRuntimeDependencies';
import { ModpackDependencySummary } from '../../sidebar/ModpackDependencySummary';
import { ModloaderSection } from '../../sidebar/ModloaderSection';
import { OptifineToggle } from '../../sidebar/OptifineToggle';
import { Input } from '../../ui/Input';
import { Select } from '../../ui/Select';

type Translate = (key: string, params?: Record<string, string | number>) => string;

interface CreationRuntimeStepProps {
  draft: ModpackCreationDraft;
  runtime: RuntimeDependencyState;
  versions: readonly MCVersion[];
  forgeVersions: string[];
  fabricVersions: string[];
  neoForgeVersions: string[];
  isOptiFineSupported: boolean;
  updateDraft: (patch: Partial<ModpackCreationDraft>) => void;
  t: Translate;
  getAccentStyles: (type: 'bg') => { className?: string; style?: CSSProperties };
}

export function CreationRuntimeStep({
  draft,
  runtime,
  versions,
  forgeVersions,
  fabricVersions,
  neoForgeVersions,
  isOptiFineSupported,
  updateDraft,
  t,
  getAccentStyles,
}: CreationRuntimeStepProps) {
  const releaseVersions = versions.filter((version) => version.type === 'release');
  const hasCurrentVersion = releaseVersions.some((version) => version.id === draft.minecraftVersion);

  const setLoader = (loader: 'vanilla' | 'forge' | 'fabric' | 'neoforge') => {
    updateDraft({
      useForge: loader === 'forge',
      useFabric: loader === 'fabric',
      useNeoForge: loader === 'neoforge',
    });
  };

  return (
    <div className="space-y-4">
      <div className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
        {t('wizard.step2_desc') || 'Select Minecraft version and modloader'}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          label={t('modpacks.version')}
          value={draft.version}
          onChange={(event) => updateDraft({ version: event.target.value })}
          placeholder="1.0.0"
          maxLength={64}
        />

        <Select
          label={t('modpacks.minecraft_version')}
          value={draft.minecraftVersion}
          onChange={(event) => updateDraft({ minecraftVersion: event.target.value })}
        >
          {!hasCurrentVersion ? (
            <option value={draft.minecraftVersion}>{draft.minecraftVersion}</option>
          ) : null}
          {releaseVersions.map((version) => (
            <option key={version.id} value={version.id}>{version.id}</option>
          ))}
        </Select>
      </div>

      <ModloaderSection
        version={draft.minecraftVersion}
        useForge={draft.useForge}
        setUseForge={(useForge) => setLoader(useForge ? 'forge' : 'vanilla')}
        useFabric={draft.useFabric}
        setUseFabric={(useFabric) => setLoader(useFabric ? 'fabric' : 'vanilla')}
        useNeoForge={draft.useNeoForge}
        setUseNeoForge={(useNeoForge) => setLoader(useNeoForge ? 'neoforge' : 'vanilla')}
        setLoader={setLoader}
        forgeSupportedVersions={forgeVersions}
        fabricSupportedVersions={fabricVersions}
        neoForgeSupportedVersions={neoForgeVersions}
        t={t}
        getAccentStyles={getAccentStyles}
      />

      <OptifineToggle
        isOptiFineSupported={isOptiFineSupported}
        useForge={draft.useForge}
        useOptiFine={draft.useOptiFine}
        setUseOptiFine={(useOptiFine) => updateDraft({ useOptiFine })}
        t={t}
        getAccentStyles={getAccentStyles}
      />

      <ModpackDependencySummary runtime={runtime} t={t} />
    </div>
  );
}
