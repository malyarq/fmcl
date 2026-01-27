import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { useSettings } from './SettingsContext';
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
} from './instances/services/instancesService';

export type { ModpackConfig, ModpackListItem, ModLoaderType, NetworkMode };

interface ModpackContextState {
  isReady: boolean;
  modpacks: ModpackListItem[];
  selectedId: string;
  config: ModpackConfig | null;

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

export const ModpackProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { minecraftPath } = useSettings();
  const rootPath = minecraftPath || undefined;

  const [isReady, setIsReady] = useState(false);
  const [modpacks, setModpacks] = useState<ModpackListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string>('default');
  const [config, setConfig] = useState<ModpackConfig | null>(null);

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

  useInstanceNetworkModeSync(config?.networkMode);

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

  const { select, create, rename, duplicate, remove } = useInstanceCrudActions({
    rootPath,
    selectedId,
    setSelectedId,
    setConfig,
    refresh,
    loadSelected,
  });

  const value = useMemo<ModpackContextState>(() => ({
    isReady,
    modpacks,
    selectedId,
    config,
    refresh,
    select,
    create,
    rename,
    duplicate,
    remove,
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
  }), [
    config,
    create,
    duplicate,
    modpacks,
    isReady,
    patchConfig,
    refresh,
    remove,
    rename,
    saveConfig,
    select,
    selectedId,
    setAutoConnectServer,
    setGameExtraArgs,
    setGameResolution,
    setJavaPath,
    setMemoryGb,
    setNetworkMode,
    setRuntimeLoader,
    setRuntimeMinecraft,
    setVmOptions,
  ]);

  return <ModpackContext.Provider value={value}>{children}</ModpackContext.Provider>;
};

export const useModpack = () => {
  const ctx = useContext(ModpackContext);
  if (!ctx) throw new Error('useModpack must be used within a ModpackProvider');
  return ctx;
};

export { getInstanceRamGb };
