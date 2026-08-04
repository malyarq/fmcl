import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { SetStateAction } from 'react';
import type { OperationSnapshot } from '@shared/contracts';
import { useSettings, useUIMode } from './SettingsContext';
import { CLASSIC_MODPACK_ID } from '../../shared/constants';
import type { ModpackConfig, ModpackListItem, ModLoaderType, NetworkMode } from './instances/types';

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
  withModpackMinMemoryGb,
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
  duplicateOperation: OperationSnapshot | null;
  remove: (id: string) => Promise<void>;

  saveConfig: (cfg: ModpackConfig) => Promise<void>;
  patchConfig: (patch: Partial<ModpackConfig>) => void;
  setMemoryGb: (gb: number) => void;
  setMinMemoryGb: (gb: number) => void;
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
  rename: (id: string, name: string) => Promise<void>;
  duplicate: (sourceId: string, name?: string) => Promise<void>;
  refresh: () => Promise<void>;
  loadSelected: () => Promise<void>;
} | undefined>(undefined);

export const ModpackProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { minecraftPath } = useSettings();
  const { uiMode } = useUIMode();
  const rootPath = minecraftPath || undefined;

  const [bootstrapReady, setBootstrapReady] = useState(false);
  const [modpacks, setModpacks] = useState<ModpackListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [config, setConfig] = useState<ModpackConfig | null>(null);
  const [classicConfigState, setClassicConfigState] = useState<{
    rootPath?: string;
    config: ModpackConfig | null;
  }>({
    rootPath: undefined,
    config: null,
  });

  const isClassicMode = uiMode === 'simple';
  const classicConfig = classicConfigState.rootPath === rootPath ? classicConfigState.config : null;

  const setClassicConfig = useCallback((next: SetStateAction<ModpackConfig | null>) => {
    setClassicConfigState((current) => {
      const currentConfig = current.rootPath === rootPath ? current.config : null;
      const resolvedConfig = typeof next === 'function'
        ? next(currentConfig)
        : next;

      return {
        rootPath,
        config: resolvedConfig,
      };
    });
  }, [rootPath]);

  const fetchConfig = useCallback(async (id: string) => {
    return await fetchModpackConfig(id);
  }, []);

  const refresh = useCallback(async () => {
    const list = await listModpacksSvc();
    setModpacks(list);
    const selected = list.find((i) => i.selected)?.id;
    if (selected) setSelectedId(selected);
  }, []);

  const loadSelected = useCallback(async () => {
    const id = await getSelectedModpackId();
    if (id === null) {
      setSelectedId('');
      setConfig(null);
      return;
    }
    setSelectedId(id);
    setConfig(await fetchConfig(id));
  }, [fetchConfig]);

  useInstanceBootstrap({
    refresh,
    loadSelected,
    setIsReady: setBootstrapReady,
    setSelectedId,
    setConfig,
  });

  // Load classic config when in Classic mode (hidden default instance).
  useEffect(() => {
    if (!isClassicMode) return;

    let cancelled = false;
    fetchModpackConfig(CLASSIC_MODPACK_ID).then((cfg) => {
      if (!cancelled) {
        setClassicConfigState({
          rootPath,
          config: cfg,
        });
      }
    });
    return () => { cancelled = true; };
  }, [fetchConfig, isClassicMode, rootPath]);

  useInstanceNetworkModeSync(isClassicMode ? classicConfig?.networkMode : config?.networkMode);

  const {
    saveConfig,
    patchConfig,
    setMemoryGb,
    setMinMemoryGb,
    setJavaPath,
    setRuntimeMinecraft,
    setRuntimeLoader,
    setNetworkMode,
    setVmOptions,
    setGameExtraArgs,
    setGameResolution,
    setAutoConnectServer,
  } = useInstanceConfigPersistence({ setConfig });

  const {
    saveConfig: saveClassicConfig,
    patchConfig: patchClassicConfig,
    setMemoryGb: setClassicMemoryGb,
    setMinMemoryGb: setClassicMinMemoryGb,
    setJavaPath: setClassicJavaPath,
    setRuntimeMinecraft: setClassicRuntimeMinecraft,
    setRuntimeLoader: setClassicRuntimeLoader,
    setNetworkMode: setClassicNetworkMode,
    setVmOptions: setClassicVmOptions,
    setGameExtraArgs: setClassicGameExtraArgs,
    setGameResolution: setClassicGameResolution,
    setAutoConnectServer: setClassicAutoConnectServer,
  } = useInstanceConfigPersistence({ setConfig: setClassicConfig });

  const effectiveConfig = isClassicMode ? classicConfig : config;
  const effectiveModpackId = isClassicMode ? CLASSIC_MODPACK_ID : selectedId;
  const isReady = bootstrapReady && effectiveConfig !== null;

  const effectiveSaveConfig = isClassicMode ? saveClassicConfig : saveConfig;
  const effectivePatchConfig = isClassicMode ? patchClassicConfig : patchConfig;

  // Classic setters: when classicConfig is null (not yet loaded), fetch first then apply.
  const effectiveSetMemoryGb = useCallback(
    (gb: number) => {
      if (isClassicMode) {
        if (classicConfig) {
          setClassicMemoryGb(gb);
        } else {
          fetchModpackConfig(CLASSIC_MODPACK_ID).then((cfg) => {
            if (!cfg) return;
            const next = withModpackMemoryGb(cfg, gb);
            setClassicConfig(next);
            void saveModpackConfigSvc(next);
          });
        }
      } else {
        setMemoryGb(gb);
      }
    },
    [classicConfig, isClassicMode, setClassicConfig, setClassicMemoryGb, setMemoryGb]
  );

  const effectiveSetMinMemoryGb = useCallback(
    (gb: number) => {
      if (isClassicMode) {
        if (classicConfig) {
          setClassicMinMemoryGb(gb);
        } else {
          fetchModpackConfig(CLASSIC_MODPACK_ID).then((cfg) => {
            if (!cfg) return;
            const next = withModpackMinMemoryGb(cfg, gb);
            setClassicConfig(next);
            void saveModpackConfigSvc(next);
          });
        }
      } else {
        setMinMemoryGb(gb);
      }
    },
    [classicConfig, isClassicMode, setClassicConfig, setClassicMinMemoryGb, setMinMemoryGb]
  );

  const effectiveSetJavaPath = useCallback(
    (javaPath: string) => {
      if (isClassicMode) {
        if (classicConfig) {
          setClassicJavaPath(javaPath);
        } else {
          fetchModpackConfig(CLASSIC_MODPACK_ID).then((cfg) => {
            if (!cfg) return;
            const next = withModpackJavaPath(cfg, javaPath);
            setClassicConfig(next);
            void saveModpackConfigSvc(next);
          });
        }
      } else {
        setJavaPath(javaPath);
      }
    },
    [classicConfig, isClassicMode, setClassicConfig, setClassicJavaPath, setJavaPath]
  );
  const effectiveSetRuntimeMinecraft = useCallback(
    (mc: string) => {
      if (isClassicMode) {
        if (classicConfig) {
          setClassicRuntimeMinecraft(mc);
        } else {
          fetchModpackConfig(CLASSIC_MODPACK_ID).then((cfg) => {
            if (!cfg) return;
            const next = withRuntimeMinecraft(cfg, mc);
            setClassicConfig(next);
            void saveModpackConfigSvc(next);
          });
        }
      } else {
        setRuntimeMinecraft(mc);
      }
    },
    [classicConfig, isClassicMode, setClassicConfig, setClassicRuntimeMinecraft, setRuntimeMinecraft]
  );

  const effectiveSetRuntimeLoader = useCallback(
    (loader: ModLoaderType) => {
      if (isClassicMode) {
        if (classicConfig) {
          setClassicRuntimeLoader(loader);
        } else {
          fetchModpackConfig(CLASSIC_MODPACK_ID).then((cfg) => {
            if (!cfg) return;
            const next = withRuntimeLoader(cfg, loader);
            setClassicConfig(next);
            void saveModpackConfigSvc(next);
          });
        }
      } else {
        setRuntimeLoader(loader);
      }
    },
    [classicConfig, isClassicMode, setClassicConfig, setClassicRuntimeLoader, setRuntimeLoader]
  );
  const effectiveSetNetworkMode = isClassicMode ? setClassicNetworkMode : setNetworkMode;
  const effectiveSetVmOptions = isClassicMode ? setClassicVmOptions : setVmOptions;
  const effectiveSetGameExtraArgs = isClassicMode ? setClassicGameExtraArgs : setGameExtraArgs;
  const effectiveSetGameResolution = isClassicMode ? setClassicGameResolution : setGameResolution;
  const effectiveSetAutoConnectServer = isClassicMode ? setClassicAutoConnectServer : setAutoConnectServer;

  const { select, create, rename, duplicate, duplicateOperation, remove } = useInstanceCrudActions({
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
    loadSelected,
    rename,
    duplicate,
  }), [modpacks, selectedId, select, remove, refresh, loadSelected, rename, duplicate]);

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
    duplicateOperation,
    remove,
    saveConfig: effectiveSaveConfig,
    patchConfig: effectivePatchConfig,
    setMemoryGb: effectiveSetMemoryGb,
    setMinMemoryGb: effectiveSetMinMemoryGb,
    setJavaPath: effectiveSetJavaPath,
    setRuntimeMinecraft: effectiveSetRuntimeMinecraft,
    setRuntimeLoader: effectiveSetRuntimeLoader,
    setNetworkMode: effectiveSetNetworkMode,
    setVmOptions: effectiveSetVmOptions,
    setGameExtraArgs: effectiveSetGameExtraArgs,
    setGameResolution: effectiveSetGameResolution,
    setAutoConnectServer: effectiveSetAutoConnectServer,
  }), [

    create,
    duplicate,
    duplicateOperation,
    effectiveConfig,
    effectiveModpackId,
    effectivePatchConfig,
    effectiveSaveConfig,
    effectiveSetAutoConnectServer,
    effectiveSetGameExtraArgs,
    effectiveSetGameResolution,
    effectiveSetJavaPath,
    effectiveSetMemoryGb,
    effectiveSetMinMemoryGb,
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

// eslint-disable-next-line react-refresh/only-export-components
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
