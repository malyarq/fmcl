import { useCallback, useMemo } from 'react';
import type { ModpackConfig, ModLoaderType } from '../../../contexts/instances/types';
import { useInstanceConfigCommands } from '../../instances/hooks/useInstanceConfigCommands';
import { useInstanceInvalidation } from '../../instances/hooks/useInstanceInvalidation';
import { useInstanceSnapshot } from '../../instances/hooks/useInstanceSelectors';

function buildUpdatedRuntimeConfig(
  currentConfig: ModpackConfig,
  loader: ModLoaderType,
): ModpackConfig {
  const previousLoaderType = currentConfig.runtime.modLoader?.type ?? 'vanilla';
  const nextModLoader = previousLoaderType === loader
    ? currentConfig.runtime.modLoader ?? { type: loader }
    : loader === 'vanilla'
      ? { type: 'vanilla' as const }
      : { type: loader };

  return {
    ...currentConfig,
    runtime: { ...currentConfig.runtime, modLoader: nextModLoader },
    game: loader === 'forge'
      ? currentConfig.game
      : { ...(currentConfig.game ?? {}), useOptiFine: false },
  };
}

export interface UseModpackDetailsConfigParams {
  modpackId: string;
}

export interface ModpackDetailsConfigSetters {
  setMemoryGb: (gb: number) => Promise<void>;
  setMinMemoryGb: (gb: number) => Promise<void>;
  setVmOptions: (options: string[]) => Promise<void>;
  setGameExtraArgs: (args: string[]) => Promise<void>;
  setGameResolution: (resolution?: { width?: number; height?: number; fullscreen?: boolean }) => Promise<void>;
  setAutoConnectServer: (server?: { host: string; port: number }) => Promise<void>;
  setRuntimeMinecraft: (minecraft: string) => Promise<void>;
  setRuntimeLoader: (loader: ModLoaderType) => Promise<void>;
  setUseOptiFine: (enabled: boolean) => Promise<void>;
}

export interface UseModpackDetailsConfigResult {
  effectiveConfig: ModpackConfig | null;
  modpackConfig: ModpackConfig | null;
  loadModpackConfig: () => Promise<void>;
  setters: ModpackDetailsConfigSetters;
}

/** ID-keyed detail projection over the singleton instance owner. */
export function useModpackDetailsConfig({
  modpackId,
}: UseModpackDetailsConfigParams): UseModpackDetailsConfigResult {
  const query = useInstanceSnapshot(modpackId);
  const commands = useInstanceConfigCommands(modpackId);
  const { invalidateInstance } = useInstanceInvalidation();
  const effectiveConfig = query.status === 'ready' ? query.data : null;

  const loadModpackConfig = useCallback(
    () => invalidateInstance(modpackId),
    [invalidateInstance, modpackId],
  );

  const setRuntimeLoader = useCallback(async (loader: ModLoaderType) => {
    if (!effectiveConfig) return;
    await commands.saveConfig(buildUpdatedRuntimeConfig(effectiveConfig, loader));
  }, [commands, effectiveConfig]);

  const setUseOptiFine = useCallback(async (enabled: boolean) => {
    if (!effectiveConfig) return;
    await commands.patchConfig({
      game: { ...(effectiveConfig.game ?? {}), useOptiFine: enabled },
    });
  }, [commands, effectiveConfig]);

  const setters = useMemo<ModpackDetailsConfigSetters>(() => ({
    setMemoryGb: commands.setMemoryGb,
    setMinMemoryGb: commands.setMinMemoryGb,
    setVmOptions: commands.setVmOptions,
    setGameExtraArgs: commands.setGameExtraArgs,
    setGameResolution: commands.setGameResolution,
    setAutoConnectServer: commands.setAutoConnectServer,
    setRuntimeMinecraft: commands.setRuntimeMinecraft,
    setRuntimeLoader,
    setUseOptiFine,
  }), [commands, setRuntimeLoader, setUseOptiFine]);

  return {
    effectiveConfig,
    modpackConfig: effectiveConfig,
    loadModpackConfig,
    setters,
  };
}
