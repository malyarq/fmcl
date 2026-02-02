import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useSettings, useUIMode } from './SettingsContext';
import { CLASSIC_MODPACK_ID } from '../../shared/constants';
import type { ModpackConfig, ModpackListItem, ModLoaderType, NetworkMode } from './instances/types';
import { getInstanceRamGb } from './instances/utils/memory';
import { useInstanceBootstrap } from './instances/hooks/useInstanceBootstrap';
import { useInstanceConfigPersistence } from './instances/hooks/useInstanceConfigPersistence';
import { useInstanceCrudActions } from './instances/hooks/useInstanceCrudActions';
import { useInstanceNetworkModeSync } from './instances/hooks/useInstanceNetworkModeSync';
import {
  fetchModpackConfig,
  getSelectedModpackId,
  listModpacks as listModpacksSvc,
  saveModpackConfig as saveModpackConfigSvc,
} from './instances/services/instancesService';
import {
  withModpackJavaPath,
  withModpackMemoryGb,
  withRuntimeLoader,
  withRuntimeMinecraft,
} from './instances/utils/configPatching';

export type { ModpackConfig, ModpackListItem, ModLoaderType, NetworkMode };

interface ModpackContextState {
  isReady: boolean;
  modpacks: ModpackListItem[];
  selectedId: string;
  /** Effective config for launch/display: classic config in Classic mode, selected modpack config otherwise. */
  config: ModpackConfig | null;
  /** Effective modpack ID for launch: CLASSIC_MODPACK_ID in Classic mode, selectedId otherwise. */
  effectiveModpackId: string;

  refresh: () => Promise<void>;
  select: (id: string) => Promise<void>;
  create: (name: string) => Promise<void>;
  rename: (id: string, name: string) => Promise<void>;
  duplicate: (sourceId: string, name?: string) => Promise<void>;
  remove: (id: string) => Promise<void>;

  saveConfig: (cfg: ModpackConfig) => Promise<void>;
  patchConfig: (patch: Partial<ModpackConfig>) => void;
  setMemoryGb: (gb: number) => void;
  setJavaPath: (javaPath: string) => void;
  setRuntimeMinecraft: (mc: string) => void;
  setRuntimeLoader: (loader: ModLoaderType) => void;
  setNetworkMode: (mode: NetworkMode) => void;
  setVmOptions: (vmOptions: string[]) => void;
  setGameExtraArgs: (args: string[]) => void;
  setGameResolution: (resolution?: { width?: number; height?: number; fullscreen?: boolean }) => void;
  setAutoConnectServer: (server?: { host: string; port: number }) => void;
}

const ModpackContext = createContext<ModpackContextState | undefined>(undefined);

/** Stable subset for ModpackList — only updates when modpacks/selectedId change, not when config changes. */
const ModpackListContext = createContext<{
  modpacks: ModpackListItem[];
  selectedId: string;
  select: (id: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
} | undefined>(undefined);

export const ModpackProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { minecraftPath } = useSettings();
  const { uiMode } = useUIMode();
  const rootPath = minecraftPath || undefined;

  const [isReady, setIsReady] = useState(false);
  const [modpacks, setModpacks] = useState<ModpackListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string>('default');
  const [config, setConfig] = useState<ModpackConfig | null>(null);
  const [classicConfig, setClassicConfig] = useState<ModpackConfig | null>(null);

  const isClassicMode = uiMode === 'simple';

  const fetchConfig = useCallback(async (id: string) => {
    return await fetchModpackConfig(id, rootPath);
  }, [rootPath]);

  const refresh = useCallback(async () => {
    const list = await listModpacksSvc(rootPath);
    setModpacks(list);
    const selected = list.find((i) => i.selected)?.id;
    if (selected) setSelectedId(selected);
  }, [rootPath]);

  const loadSelected = useCallback(async () => {
    const id = await getSelectedModpackId(rootPath);
    const nextId = id || 'default';
    setSelectedId(nextId);
    const cfg = await fetchConfig(nextId);
    setConfig(cfg);
  }, [fetchConfig, rootPath]);

  useInstanceBootstrap({
    rootPath,
    refresh,
    loadSelected,
    setIsReady,
    setSelectedId,
    setConfig,
  });

  // Load classic config when in Classic mode (hidden default instance).
  useEffect(() => {
    if (!isClassicMode || !rootPath) return;
    let cancelled = false;
    fetchModpackConfig(CLASSIC_MODPACK_ID, rootPath).then((cfg) => {
      if (!cancelled) setClassicConfig(cfg);
    });
    return () => { cancelled = true; };
  }, [isClassicMode, rootPath]);

  useInstanceNetworkModeSync(isClassicMode ? classicConfig?.networkMode : config?.networkMode);

  const {
    saveConfig,
    patchConfig,
    setMemoryGb,
    setJavaPath,
    setRuntimeMinecraft,
    setRuntimeLoader,
    setNetworkMode,
    setVmOptions,
    setGameExtraArgs,
    setGameResolution,
    setAutoConnectServer,
  } = useInstanceConfigPersistence({ rootPath, setConfig });

  const {
    saveConfig: saveClassicConfig,
    patchConfig: patchClassicConfig,
    setMemoryGb: setClassicMemoryGb,
    setJavaPath: setClassicJavaPath,
    setRuntimeMinecraft: setClassicRuntimeMinecraft,
    setRuntimeLoader: setClassicRuntimeLoader,
    setNetworkMode: setClassicNetworkMode,
    setVmOptions: setClassicVmOptions,
    setGameExtraArgs: setClassicGameExtraArgs,
    setGameResolution: setClassicGameResolution,
    setAutoConnectServer: setClassicAutoConnectServer,
  } = useInstanceConfigPersistence({ rootPath, setConfig: setClassicConfig });

  const effectiveConfig = isClassicMode ? classicConfig : config;
  const effectiveModpackId = isClassicMode ? CLASSIC_MODPACK_ID : selectedId;

  const effectiveSaveConfig = isClassicMode ? saveClassicConfig : saveConfig;
  const effectivePatchConfig = isClassicMode ? patchClassicConfig : patchConfig;

  // Classic setters: when classicConfig is null (not yet loaded), fetch first then apply.
  const effectiveSetMemoryGb = useCallback(
    (gb: number) => {
      if (isClassicMode) {
        if (classicConfig) {
          setClassicMemoryGb(gb);
        } else {
          fetchModpackConfig(CLASSIC_MODPACK_ID, rootPath).then((cfg) => {
            const next = withModpackMemoryGb(cfg, gb);
            setClassicConfig(next);
            void saveModpackConfigSvc(next, rootPath);
          });
        }
      } else {
        setMemoryGb(gb);
      }
    },
    [isClassicMode, classicConfig, rootPath, setClassicMemoryGb, setMemoryGb]
  );

  const effectiveSetJavaPath = useCallback(
    (javaPath: string) => {
      if (isClassicMode) {
        if (classicConfig) {
          setClassicJavaPath(javaPath);
        } else {
          fetchModpackConfig(CLASSIC_MODPACK_ID, rootPath).then((cfg) => {
            const next = withModpackJavaPath(cfg, javaPath);
            setClassicConfig(next);
            void saveModpackConfigSvc(next, rootPath);
          });
        }
      } else {
        setJavaPath(javaPath);
      }
    },
    [isClassicMode, classicConfig, rootPath, setClassicJavaPath, setJavaPath]
  );
  const effectiveSetRuntimeMinecraft = useCallback(
    (mc: string) => {
      if (isClassicMode) {
        if (classicConfig) {
          setClassicRuntimeMinecraft(mc);
        } else {
          fetchModpackConfig(CLASSIC_MODPACK_ID, rootPath).then((cfg) => {
            const next = withRuntimeMinecraft(cfg, mc);
            setClassicConfig(next);
            void saveModpackConfigSvc(next, rootPath);
          });
        }
      } else {
        setRuntimeMinecraft(mc);
      }
    },
    [isClassicMode, classicConfig, rootPath, setClassicRuntimeMinecraft, setRuntimeMinecraft]
  );

  const effectiveSetRuntimeLoader = useCallback(
    (loader: ModLoaderType) => {
      if (isClassicMode) {
        if (classicConfig) {
          setClassicRuntimeLoader(loader);
        } else {
          fetchModpackConfig(CLASSIC_MODPACK_ID, rootPath).then((cfg) => {
            const next = withRuntimeLoader(cfg, loader);
            setClassicConfig(next);
            void saveModpackConfigSvc(next, rootPath);
          });
        }
      } else {
        setRuntimeLoader(loader);
      }
    },
    [isClassicMode, classicConfig, rootPath, setClassicRuntimeLoader, setRuntimeLoader]
  );
  const effectiveSetNetworkMode = isClassicMode ? setClassicNetworkMode : setNetworkMode;
  const effectiveSetVmOptions = isClassicMode ? setClassicVmOptions : setVmOptions;
  const effectiveSetGameExtraArgs = isClassicMode ? setClassicGameExtraArgs : setGameExtraArgs;
  const effectiveSetGameResolution = isClassicMode ? setClassicGameResolution : setGameResolution;
  const effectiveSetAutoConnectServer = isClassicMode ? setClassicAutoConnectServer : setAutoConnectServer;

  const { select, create, rename, duplicate, remove } = useInstanceCrudActions({
    rootPath,
    selectedId,
    setSelectedId,
    setConfig,
    refresh,
    loadSelected,
  });

  const listValue = useMemo(() => ({
    modpacks,
    selectedId,
    select,
    remove,
    refresh,
  }), [modpacks, selectedId, select, remove, refresh]);

  const value = useMemo<ModpackContextState>(() => ({
    isReady,
    modpacks,
    selectedId,
    config: effectiveConfig,
    effectiveModpackId,
    refresh,
    select,
    create,
    rename,
    duplicate,
    remove,
    saveConfig: effectiveSaveConfig,
    patchConfig: effectivePatchConfig,
    setMemoryGb: effectiveSetMemoryGb,
    setJavaPath: effectiveSetJavaPath,
    setRuntimeMinecraft: effectiveSetRuntimeMinecraft,
    setRuntimeLoader: effectiveSetRuntimeLoader,
    setNetworkMode: effectiveSetNetworkMode,
    setVmOptions: effectiveSetVmOptions,
    setGameExtraArgs: effectiveSetGameExtraArgs,
    setGameResolution: effectiveSetGameResolution,
    setAutoConnectServer: effectiveSetAutoConnectServer,
  }), [
    classicConfig,
    config,
    create,
    duplicate,
    effectiveConfig,
    effectiveModpackId,
    effectivePatchConfig,
    effectiveSaveConfig,
    effectiveSetAutoConnectServer,
    effectiveSetGameExtraArgs,
    effectiveSetGameResolution,
    effectiveSetJavaPath,
    effectiveSetMemoryGb,
    effectiveSetNetworkMode,
    effectiveSetRuntimeLoader,
    effectiveSetRuntimeMinecraft,
    effectiveSetVmOptions,
    isReady,
    modpacks,
    refresh,
    remove,
    rename,
    select,
    selectedId,
  ]);

  return (
    <ModpackContext.Provider value={value}>
      <ModpackListContext.Provider value={listValue}>{children}</ModpackListContext.Provider>
    </ModpackContext.Provider>
  );
};

export const useModpackListContext = () => {
  const ctx = useContext(ModpackListContext);
  if (!ctx) throw new Error('useModpackListContext must be used within ModpackProvider');
  return ctx;
};

export const useModpack = () => {
  const ctx = useContext(ModpackContext);
  if (!ctx) throw new Error('useModpack must be used within a ModpackProvider');
  return ctx;
};

export { getInstanceRamGb };
