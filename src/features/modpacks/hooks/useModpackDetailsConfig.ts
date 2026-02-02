import { useCallback, useState } from 'react';
import { useModpack, type ModpackConfig, type ModLoaderType } from '../../../contexts/ModpackContext';
import { fetchModpackConfig } from '../../../contexts/instances/services/instancesService';
import {
  withModpackMemoryGb,
  withModpackJavaPath,
  withRuntimeMinecraft,
  withRuntimeLoader,
  withVmOptions,
  withGameExtraArgs,
  withGameResolution,
  withAutoConnectServer,
} from '../../../contexts/instances/utils/configPatching';

export interface UseModpackDetailsConfigParams {
  modpackId: string;
  minecraftPath: string;
}

export interface ModpackDetailsConfigSetters {
  setMemoryGb: (gb: number) => Promise<void>;
  setJavaPath: (path: string) => Promise<void>;
  setVmOptions: (options: string[]) => Promise<void>;
  setGameExtraArgs: (args: string[]) => Promise<void>;
  setGameResolution: (resolution?: { width?: number; height?: number; fullscreen?: boolean }) => Promise<void>;
  setAutoConnectServer: (server?: { host: string; port: number }) => Promise<void>;
  setRuntimeMinecraft: (mc: string) => Promise<void>;
  setRuntimeLoader: (loader: ModLoaderType) => Promise<void>;
  setUseOptiFine: (enabled: boolean) => Promise<void>;
}

export interface UseModpackDetailsConfigResult {
  effectiveConfig: ModpackConfig | null;
  modpackConfig: ModpackConfig | null;
  setModpackConfig: React.Dispatch<React.SetStateAction<ModpackConfig | null>>;
  loadModpackConfig: () => Promise<void>;
  setters: ModpackDetailsConfigSetters;
}

/**
 * Хук для работы с конфигом модпака на странице деталей.
 * Для выбранного модпака использует контекст; для остальных — локальный config + saveConfig.
 */
export function useModpackDetailsConfig({
  modpackId,
  minecraftPath,
}: UseModpackDetailsConfigParams): UseModpackDetailsConfigResult {
  const {
    selectedId,
    config,
    setMemoryGb: ctxSetMemoryGb,
    setJavaPath: ctxSetJavaPath,
    setVmOptions: ctxSetVmOptions,
    setGameExtraArgs: ctxSetGameExtraArgs,
    setGameResolution: ctxSetGameResolution,
    setAutoConnectServer: ctxSetAutoConnectServer,
    setRuntimeMinecraft: ctxSetRuntimeMinecraft,
    setRuntimeLoader: ctxSetRuntimeLoader,
    patchConfig,
    saveConfig,
  } = useModpack();

  const [modpackConfig, setModpackConfig] = useState<ModpackConfig | null>(null);
  const isSelectedModpack = selectedId === modpackId;
  const effectiveConfig = isSelectedModpack ? config : modpackConfig;

  const loadModpackConfig = useCallback(async () => {
    try {
      const cfg = await fetchModpackConfig(modpackId, minecraftPath);
      setModpackConfig(cfg);
    } catch (error) {
      console.error('Error loading modpack config:', error);
    }
  }, [modpackId, minecraftPath]);

  const setMemoryGb = useCallback(
    async (gb: number) => {
      if (isSelectedModpack) {
        ctxSetMemoryGb(gb);
      } else if (modpackConfig) {
        const updated = withModpackMemoryGb(modpackConfig, gb);
        setModpackConfig(updated);
        await saveConfig(updated);
      }
    },
    [isSelectedModpack, modpackConfig, ctxSetMemoryGb, saveConfig]
  );

  const setJavaPath = useCallback(
    async (path: string) => {
      if (isSelectedModpack) {
        ctxSetJavaPath(path);
      } else if (modpackConfig) {
        const updated = withModpackJavaPath(modpackConfig, path);
        setModpackConfig(updated);
        await saveConfig(updated);
      }
    },
    [isSelectedModpack, modpackConfig, ctxSetJavaPath, saveConfig]
  );

  const setVmOptions = useCallback(
    async (options: string[]) => {
      if (isSelectedModpack) {
        ctxSetVmOptions(options);
      } else if (modpackConfig) {
        const updated = withVmOptions(modpackConfig, options);
        setModpackConfig(updated);
        await saveConfig(updated);
      }
    },
    [isSelectedModpack, modpackConfig, ctxSetVmOptions, saveConfig]
  );

  const setGameExtraArgs = useCallback(
    async (args: string[]) => {
      if (isSelectedModpack) {
        ctxSetGameExtraArgs(args);
      } else if (modpackConfig) {
        const updated = withGameExtraArgs(modpackConfig, args);
        setModpackConfig(updated);
        await saveConfig(updated);
      }
    },
    [isSelectedModpack, modpackConfig, ctxSetGameExtraArgs, saveConfig]
  );

  const setGameResolution = useCallback(
    async (resolution?: { width?: number; height?: number; fullscreen?: boolean }) => {
      if (isSelectedModpack) {
        ctxSetGameResolution(resolution);
      } else if (modpackConfig) {
        const updated = withGameResolution(modpackConfig, resolution);
        setModpackConfig(updated);
        await saveConfig(updated);
      }
    },
    [isSelectedModpack, modpackConfig, ctxSetGameResolution, saveConfig]
  );

  const setAutoConnectServer = useCallback(
    async (server?: { host: string; port: number }) => {
      if (isSelectedModpack) {
        ctxSetAutoConnectServer(server);
      } else if (modpackConfig) {
        const updated = withAutoConnectServer(modpackConfig, server);
        setModpackConfig(updated);
        await saveConfig(updated);
      }
    },
    [isSelectedModpack, modpackConfig, ctxSetAutoConnectServer, saveConfig]
  );

  const setRuntimeMinecraft = useCallback(
    async (mc: string) => {
      if (isSelectedModpack) {
        ctxSetRuntimeMinecraft(mc);
      } else if (modpackConfig) {
        const updated = withRuntimeMinecraft(modpackConfig, mc);
        setModpackConfig(updated);
        await saveConfig(updated);
      }
    },
    [isSelectedModpack, modpackConfig, ctxSetRuntimeMinecraft, saveConfig]
  );

  const setRuntimeLoader = useCallback(
    async (loader: ModLoaderType) => {
      if (isSelectedModpack) {
        ctxSetRuntimeLoader(loader);
      } else if (modpackConfig) {
        const updated = withRuntimeLoader(modpackConfig, loader);
        setModpackConfig(updated);
        await saveConfig(updated);
      }
    },
    [isSelectedModpack, modpackConfig, ctxSetRuntimeLoader, saveConfig]
  );

  const setUseOptiFine = useCallback(
    async (enabled: boolean) => {
      if (isSelectedModpack && config) {
        patchConfig({ game: { ...(config.game ?? {}), useOptiFine: enabled } });
      } else if (modpackConfig) {
        const updated: ModpackConfig = {
          ...modpackConfig,
          game: { ...(modpackConfig.game ?? {}), useOptiFine: enabled },
        };
        setModpackConfig(updated);
        await saveConfig(updated);
      }
    },
    [isSelectedModpack, config, modpackConfig, patchConfig, saveConfig]
  );

  const setters: ModpackDetailsConfigSetters = {
    setMemoryGb,
    setJavaPath,
    setVmOptions,
    setGameExtraArgs,
    setGameResolution,
    setAutoConnectServer,
    setRuntimeMinecraft,
    setRuntimeLoader,
    setUseOptiFine,
  };

  return {
    effectiveConfig,
    modpackConfig,
    setModpackConfig,
    loadModpackConfig,
    setters,
  };
}
